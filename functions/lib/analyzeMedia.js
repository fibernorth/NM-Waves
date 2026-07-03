"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAnalyzeMedia = exports.analyzeMedia = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const vision_1 = require("@google-cloud/vision");
const moderation_1 = require("./moderation");
const getDb = () => admin.firestore();
// ---- Date extraction from filename ----
/**
 * Parse date from common camera filename patterns:
 *   PXL_YYYYMMDD_HHMMSS  (Pixel phones)
 *   IMG_YYYYMMDD_HHMMSS  (various cameras)
 *   YYYYMMDD generic fallback
 */
function parseDateFromFilename(fileName) {
    if (!fileName)
        return null;
    // Match PXL_YYYYMMDD or IMG_YYYYMMDD or DSC_YYYYMMDD patterns
    const prefixMatch = fileName.match(/(?:PXL|IMG|DSC)_(20[12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
    if (prefixMatch) {
        const d = new Date(`${prefixMatch[1]}-${prefixMatch[2]}-${prefixMatch[3]}T00:00:00Z`);
        if (!isNaN(d.getTime()))
            return d;
    }
    // Generic YYYYMMDD fallback (must be 2010-2029 range)
    const genericMatch = fileName.match(/(20[12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
    if (genericMatch) {
        const d = new Date(`${genericMatch[1]}-${genericMatch[2]}-${genericMatch[3]}T00:00:00Z`);
        if (!isNaN(d.getTime()))
            return d;
    }
    return null;
}
// ---- Jersey number extraction ----
/**
 * Extract jersey-like numbers (0-99) from OCR text blocks.
 * Filters for standalone numbers that look like jersey numbers.
 */
function extractJerseyNumbers(textBlocks) {
    const numbers = new Set();
    for (const block of textBlocks) {
        // Match standalone numbers 0-99 (word boundaries)
        const matches = block.match(/\b(\d{1,2})\b/g);
        if (matches) {
            for (const m of matches) {
                const num = parseInt(m, 10);
                if (num >= 0 && num <= 99) {
                    numbers.add(num);
                }
            }
        }
    }
    return Array.from(numbers).sort((a, b) => a - b);
}
// ---- Main analysis logic ----
async function analyzeImage(fileUrl, fileName, mediaId, docRef) {
    var _a, _b;
    const client = new vision_1.ImageAnnotatorClient();
    // Run text detection and label detection in parallel
    const [textResult, labelResult] = await Promise.all([
        client.textDetection(fileUrl),
        client.labelDetection(fileUrl),
    ]);
    // Extract text blocks
    const textAnnotations = ((_a = textResult[0]) === null || _a === void 0 ? void 0 : _a.textAnnotations) || [];
    const detectedText = textAnnotations
        .slice(0, 20) // Limit to first 20 text blocks
        .map((a) => a.description || '')
        .filter(Boolean);
    // Extract labels (top 10)
    const labelAnnotations = ((_b = labelResult[0]) === null || _b === void 0 ? void 0 : _b.labelAnnotations) || [];
    const detectedLabels = labelAnnotations
        .slice(0, 10)
        .map((a) => a.description || '')
        .filter(Boolean);
    // Extract jersey numbers from OCR text
    const detectedJerseyNumbers = extractJerseyNumbers(detectedText);
    // Parse date from filename
    const photoDate = parseDateFromFilename(fileName || '');
    // Match jersey numbers against players in the roster
    const db = getDb();
    let suggestedPlayerIds = [];
    let suggestedPlayerNames = [];
    let suggestedTeamId;
    if (detectedJerseyNumbers.length > 0) {
        // Query all players that have matching jersey numbers
        const playersSnapshot = await db.collection('players')
            .where('active', '==', true)
            .get();
        const matchedPlayers = [];
        playersSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.jerseyNumber !== undefined &&
                detectedJerseyNumbers.includes(data.jerseyNumber)) {
                matchedPlayers.push({
                    id: doc.id,
                    name: `${data.firstName} ${data.lastName}`,
                    teamId: data.teamId || '',
                });
            }
        });
        suggestedPlayerIds = matchedPlayers.map((p) => p.id);
        suggestedPlayerNames = matchedPlayers.map((p) => p.name);
        // If all matched players share the same teamId, suggest that team
        const teamIds = [...new Set(matchedPlayers.map((p) => p.teamId).filter(Boolean))];
        if (teamIds.length === 1) {
            suggestedTeamId = teamIds[0];
        }
    }
    // Build update object
    const update = {
        detectedText,
        detectedLabels,
        detectedJerseyNumbers,
        suggestedPlayerIds,
        suggestedPlayerNames,
        analysisStatus: 'analyzed',
    };
    if (suggestedTeamId) {
        update.suggestedTeamId = suggestedTeamId;
    }
    // Collect all tags to add in a single arrayUnion call
    const tagsToAdd = [];
    if (photoDate) {
        update.photoDate = admin.firestore.Timestamp.fromDate(photoDate);
        tagsToAdd.push(photoDate.getUTCFullYear().toString());
    }
    // Auto-add scene label tags for sports-related labels
    const sportsLabels = ['softball', 'baseball', 'batting', 'pitching', 'trophy',
        'team photo', 'team sport', 'ball game', 'sports equipment'];
    const matchedLabels = detectedLabels
        .filter((l) => sportsLabels.some((s) => l.toLowerCase().includes(s)));
    tagsToAdd.push(...matchedLabels.map((l) => l.toLowerCase()));
    if (tagsToAdd.length > 0) {
        update.tags = admin.firestore.FieldValue.arrayUnion(...tagsToAdd);
    }
    await docRef.update(update);
    console.log(`Analysis for ${mediaId}: ${detectedLabels.length} labels, ${detectedText.length} text blocks, ${detectedJerseyNumbers.length} jersey numbers`);
}
// ---- Firestore trigger: auto-analyze new uploads ----
/**
 * Single onCreate trigger for media — handles both moderation and analysis
 * sequentially to avoid race conditions from two triggers on the same doc.
 */
exports.analyzeMedia = functions.firestore
    .document('media/{mediaId}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    const mediaId = context.params.mediaId;
    // Only process images
    if (data.mediaType === 'video')
        return;
    if (!data.fileUrl)
        return;
    // Step 1: Run content moderation first
    try {
        await (0, moderation_1.runModeration)(snap, mediaId);
    }
    catch (moderationError) {
        console.error(`Moderation failed for ${mediaId}:`, moderationError);
        // Continue to analysis even if moderation fails
    }
    // Step 2: Run image analysis
    try {
        await snap.ref.update({ analysisStatus: 'pending' });
        await analyzeImage(data.fileUrl, data.fileName || '', mediaId, snap.ref);
    }
    catch (error) {
        console.error(`Analysis error for ${mediaId}:`, error);
        await snap.ref.update({ analysisStatus: 'failed' });
    }
});
// ---- Callable function: batch analyze existing photos ----
/**
 * Admin-triggered callable function to analyze all existing unanalyzed media items.
 * Processes in batches to respect Vision API quota.
 */
exports.batchAnalyzeMedia = functions.https.onCall(async (data, context) => {
    var _a;
    // Verify caller is admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const db = getDb();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData ||
        !(((_a = userData.roles) === null || _a === void 0 ? void 0 : _a.some((r) => ['admin', 'master-admin'].includes(r))) ||
            ['admin', 'master-admin'].includes(userData.role))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const batchSize = (data === null || data === void 0 ? void 0 : data.batchSize) || 50;
    // Find unanalyzed image media items
    const snapshot = await db.collection('media')
        .where('mediaType', '!=', 'video')
        .limit(batchSize)
        .get();
    const toAnalyze = snapshot.docs.filter((doc) => {
        const d = doc.data();
        return d.fileUrl && !d.analysisStatus;
    });
    let processed = 0;
    let failed = 0;
    for (const doc of toAnalyze) {
        const docData = doc.data();
        try {
            await doc.ref.update({ analysisStatus: 'pending' });
            await analyzeImage(docData.fileUrl, docData.fileName || '', doc.id, doc.ref);
            processed++;
        }
        catch (error) {
            console.error(`Batch analysis error for ${doc.id}:`, error);
            await doc.ref.update({ analysisStatus: 'failed' });
            failed++;
        }
    }
    return {
        total: toAnalyze.length,
        processed,
        failed,
    };
});
//# sourceMappingURL=analyzeMedia.js.map