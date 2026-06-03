import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { runModeration } from './moderation';

const getDb = () => admin.firestore();

// ---- Date extraction from filename ----

/**
 * Parse date from common camera filename patterns:
 *   PXL_YYYYMMDD_HHMMSS  (Pixel phones)
 *   IMG_YYYYMMDD_HHMMSS  (various cameras)
 *   YYYYMMDD generic fallback
 */
function parseDateFromFilename(fileName: string): Date | null {
  if (!fileName) return null;

  // Match PXL_YYYYMMDD or IMG_YYYYMMDD or DSC_YYYYMMDD patterns
  const prefixMatch = fileName.match(/(?:PXL|IMG|DSC)_(20[12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (prefixMatch) {
    const d = new Date(`${prefixMatch[1]}-${prefixMatch[2]}-${prefixMatch[3]}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }

  // Generic YYYYMMDD fallback (must be 2010-2029 range)
  const genericMatch = fileName.match(/(20[12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (genericMatch) {
    const d = new Date(`${genericMatch[1]}-${genericMatch[2]}-${genericMatch[3]}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

// ---- Jersey number extraction ----

/**
 * Extract jersey-like numbers (0-99) from OCR text blocks.
 * Filters for standalone numbers that look like jersey numbers.
 */
function extractJerseyNumbers(textBlocks: string[]): number[] {
  const numbers = new Set<number>();
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

async function analyzeImage(
  fileUrl: string,
  fileName: string,
  mediaId: string,
  docRef: admin.firestore.DocumentReference
): Promise<void> {
  const client = new ImageAnnotatorClient();

  // Run text detection and label detection in parallel
  const [textResult, labelResult] = await Promise.all([
    client.textDetection(fileUrl),
    client.labelDetection(fileUrl),
  ]);

  // Extract text blocks
  const textAnnotations = textResult[0]?.textAnnotations || [];
  const detectedText = textAnnotations
    .slice(0, 20) // Limit to first 20 text blocks
    .map((a) => a.description || '')
    .filter(Boolean);

  // Extract labels (top 10)
  const labelAnnotations = labelResult[0]?.labelAnnotations || [];
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
  let suggestedPlayerIds: string[] = [];
  let suggestedPlayerNames: string[] = [];
  let suggestedTeamId: string | undefined;

  if (detectedJerseyNumbers.length > 0) {
    // Query all players that have matching jersey numbers
    const playersSnapshot = await db.collection('players')
      .where('active', '==', true)
      .get();

    const matchedPlayers: Array<{ id: string; name: string; teamId: string }> = [];

    playersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.jerseyNumber !== undefined &&
        detectedJerseyNumbers.includes(data.jerseyNumber)
      ) {
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
  const update: Record<string, unknown> = {
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
  const tagsToAdd: string[] = [];

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
export const analyzeMedia = functions.firestore
  .document('media/{mediaId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const mediaId = context.params.mediaId;

    // Only process images
    if (data.mediaType === 'video') return;
    if (!data.fileUrl) return;

    // Step 1: Run content moderation first
    try {
      await runModeration(snap, mediaId);
    } catch (moderationError) {
      console.error(`Moderation failed for ${mediaId}:`, moderationError);
      // Continue to analysis even if moderation fails
    }

    // Step 2: Run image analysis
    try {
      await snap.ref.update({ analysisStatus: 'pending' });
      await analyzeImage(data.fileUrl, data.fileName || '', mediaId, snap.ref);
    } catch (error) {
      console.error(`Analysis error for ${mediaId}:`, error);
      await snap.ref.update({ analysisStatus: 'failed' });
    }
  });

// ---- Callable function: batch analyze existing photos ----

/**
 * Admin-triggered callable function to analyze all existing unanalyzed media items.
 * Processes in batches to respect Vision API quota.
 */
export const batchAnalyzeMedia = functions.https.onCall(async (data, context) => {
  // Verify caller is admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const db = getDb();
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  if (
    !userData ||
    !(
      userData.roles?.some((r: string) => ['admin', 'master-admin'].includes(r)) ||
      ['admin', 'master-admin'].includes(userData.role)
    )
  ) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const batchSize = (data as { batchSize?: number })?.batchSize || 50;

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
    } catch (error) {
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
