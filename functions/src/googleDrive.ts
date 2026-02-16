import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

const db = admin.firestore();

/**
 * Callable Cloud Function: lists photos from a shared Google Drive folder.
 * Reads folder ID from appSettings/integrations.
 * Uses service account credentials from Firebase Functions config.
 */
export const listDrivePhotos = functions.https.onCall(async (_data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Get integration settings
  const settingsDoc = await db.doc('appSettings/integrations').get();
  const settings = settingsDoc.data();

  if (!settings?.googleDrive?.enabled || !settings?.googleDrive?.folderId) {
    return { photos: [] };
  }

  const folderId = settings.googleDrive.folderId;

  try {
    // Get service account credentials from Firebase Functions config
    const config = functions.config();
    const serviceAccountStr = config.google_drive?.service_account;

    if (!serviceAccountStr) {
      console.error('Google Drive service account not configured');
      return { photos: [] };
    }

    const serviceAccount = JSON.parse(serviceAccountStr);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, thumbnailLink, webContentLink, createdTime, mimeType)',
      orderBy: 'createdTime desc',
      pageSize: 100,
    });

    const photos = (response.data.files || []).map((file) => ({
      id: `drive_${file.id}`,
      name: file.name,
      thumbnailUrl: file.thumbnailLink || undefined,
      fileUrl: file.webContentLink || `https://drive.google.com/uc?id=${file.id}&export=view`,
      createdAt: file.createdTime || new Date().toISOString(),
      source: 'google_drive' as const,
    }));

    return { photos };
  } catch (error) {
    console.error('Error listing Drive photos:', error);
    throw new functions.https.HttpsError('internal', 'Failed to list Drive photos');
  }
});
