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
exports.moderateMedia = void 0;
exports.runModeration = runModeration;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const vision_1 = require("@google-cloud/vision");
const getDb = () => admin.firestore();
/**
 * Firestore onCreate trigger on media/{mediaId}
 * Calls Cloud Vision SafeSearch on new image uploads.
 * Flagged images get moderationStatus: 'rejected'.
 */
/**
 * Moderate a single media document. Called by analyzeMedia's onCreate trigger
 * rather than having its own separate trigger (avoids race condition from
 * two onCreate triggers writing to the same document simultaneously).
 */
async function runModeration(snap, mediaId) {
    const data = snap.data();
    // Only moderate images, skip videos
    if (data.mediaType === 'video') {
        return;
    }
    // Skip if no file URL
    if (!data.fileUrl) {
        return;
    }
    try {
        const client = new vision_1.ImageAnnotatorClient();
        const [result] = await client.safeSearchDetection(data.fileUrl);
        const safeSearch = result.safeSearchAnnotation;
        if (!safeSearch) {
            await snap.ref.update({
                moderationStatus: 'approved',
                moderationReviewedAt: admin.firestore.Timestamp.now(),
            });
            return;
        }
        const labels = {
            adult: safeSearch.adult || 'UNKNOWN',
            violence: safeSearch.violence || 'UNKNOWN',
            racy: safeSearch.racy || 'UNKNOWN',
        };
        const FLAGGED_LEVELS = ['LIKELY', 'VERY_LIKELY'];
        const isRejected = FLAGGED_LEVELS.includes(labels.adult) ||
            FLAGGED_LEVELS.includes(labels.violence) ||
            FLAGGED_LEVELS.includes(labels.racy);
        const moderationStatus = isRejected ? 'rejected' : 'approved';
        await snap.ref.update({
            moderationStatus,
            moderationLabels: labels,
            moderationReviewedAt: admin.firestore.Timestamp.now(),
        });
        // Notify admins on rejection
        if (isRejected) {
            await getDb().collection('adminNotifications').add({
                type: 'content_moderation',
                mediaId,
                fileName: data.fileName || '',
                uploadedBy: data.uploadedBy || '',
                uploadedByName: data.uploadedByName || '',
                moderationLabels: labels,
                message: `Image "${data.fileName || mediaId}" was flagged by content moderation.`,
                read: false,
                createdAt: admin.firestore.Timestamp.now(),
            });
        }
        console.log(`Moderation for ${mediaId}: ${moderationStatus}`, labels);
    }
    catch (error) {
        console.error(`Moderation error for ${mediaId}:`, error);
        // Fail SAFE: if we couldn't scan the image, mark it 'rejected' so it is
        // hidden from the public gallery (which only excludes 'rejected'), and
        // notify admins to review/approve. Previously this wrote 'pending_review',
        // a value no UI handles, so un-scanned images were shown to everyone.
        await snap.ref.update({
            moderationStatus: 'rejected',
            moderationError: true,
            moderationReviewedAt: admin.firestore.Timestamp.now(),
        });
        await getDb().collection('adminNotifications').add({
            type: 'content_moderation',
            mediaId,
            fileName: data.fileName || '',
            uploadedBy: data.uploadedBy || '',
            uploadedByName: data.uploadedByName || '',
            message: `Image "${data.fileName || mediaId}" could not be auto-scanned and was hidden pending your review.`,
            read: false,
            createdAt: admin.firestore.Timestamp.now(),
        });
    }
}
/**
 * Firestore onCreate trigger on media/{mediaId}.
 * Kept as a thin wrapper for backward compatibility — calls runModeration.
 */
exports.moderateMedia = functions.firestore
    .document('media/{mediaId}')
    .onCreate(async (snap, context) => {
    // This trigger is now disabled — moderation is called from analyzeMedia
    // to prevent race conditions. Keeping the export so the function doesn't
    // get deleted on deploy (which would require manual cleanup).
    console.log(`moderateMedia trigger fired for ${context.params.mediaId} — skipping (handled by analyzeMedia)`);
});
//# sourceMappingURL=moderation.js.map