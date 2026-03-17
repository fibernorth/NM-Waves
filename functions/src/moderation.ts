import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ImageAnnotatorClient } from '@google-cloud/vision';

const getDb = () => admin.firestore();

/**
 * Firestore onCreate trigger on media/{mediaId}
 * Calls Cloud Vision SafeSearch on new image uploads.
 * Flagged images get moderationStatus: 'rejected'.
 */
export const moderateMedia = functions.firestore
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
      const client = new ImageAnnotatorClient();
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
      const isRejected =
        FLAGGED_LEVELS.includes(labels.adult as string) ||
        FLAGGED_LEVELS.includes(labels.violence as string);

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
    } catch (error) {
      console.error(`Moderation error for ${mediaId}:`, error);
      // On error, default to approved so uploads aren't blocked
      await snap.ref.update({
        moderationStatus: 'approved',
        moderationReviewedAt: admin.firestore.Timestamp.now(),
      });
    }
  });
