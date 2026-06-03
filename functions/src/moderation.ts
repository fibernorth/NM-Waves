import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ImageAnnotatorClient } from '@google-cloud/vision';

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
export async function runModeration(snap: functions.firestore.QueryDocumentSnapshot, mediaId: string): Promise<void> {
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
    const client = new ImageAnnotatorClient();
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
    // On error, default to pending_review so admins are aware
    await snap.ref.update({
      moderationStatus: 'pending_review',
      moderationReviewedAt: admin.firestore.Timestamp.now(),
    });
  }
}

/**
 * Firestore onCreate trigger on media/{mediaId}.
 * Kept as a thin wrapper for backward compatibility — calls runModeration.
 */
export const moderateMedia = functions.firestore
  .document('media/{mediaId}')
  .onCreate(async (snap, context) => {
    // This trigger is now disabled — moderation is called from analyzeMedia
    // to prevent race conditions. Keeping the export so the function doesn't
    // get deleted on deploy (which would require manual cleanup).
    console.log(`moderateMedia trigger fired for ${context.params.mediaId} — skipping (handled by analyzeMedia)`);
  });
