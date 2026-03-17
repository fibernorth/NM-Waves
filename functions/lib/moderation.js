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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const vision_1 = require("@google-cloud/vision");
const getDb = () => admin.firestore();
/**
 * Firestore onCreate trigger on media/{mediaId}
 * Calls Cloud Vision SafeSearch on new image uploads.
 * Flagged images get moderationStatus: 'rejected'.
 */
exports.moderateMedia = functions.firestore
    .document('media/{mediaId}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    const mediaId = context.params.mediaId;
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
            // No annotation returned; default to approved
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
            FLAGGED_LEVELS.includes(labels.violence);
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
        // On error, default to approved so uploads aren't blocked
        await snap.ref.update({
            moderationStatus: 'approved',
            moderationReviewedAt: admin.firestore.Timestamp.now(),
        });
    }
});
//# sourceMappingURL=moderation.js.map