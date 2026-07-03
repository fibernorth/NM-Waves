import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

const getDb = () => admin.firestore();

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

  // Require coach or higher role
  const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  const roles: string[] = userData?.roles || [];
  const hasAccess = roles.some(r => ['coach', 'admin', 'master-admin'].includes(r));
  if (!hasAccess) {
    throw new functions.https.HttpsError('permission-denied', 'Coach or higher role required');
  }

  // Get integration settings
  const settingsDoc = await getDb().doc('appSettings/integrations').get();
  const settings = settingsDoc.data();

  if (!settings?.googleDrive?.enabled || !settings?.googleDrive?.folderId) {
    return { photos: [] };
  }

  const folderId = settings.googleDrive.folderId;

  try {
    // Service account credentials from environment (functions/.env).
    const serviceAccountStr = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;

    if (!serviceAccountStr) {
      console.error('Google Drive service account not configured (set GOOGLE_DRIVE_SERVICE_ACCOUNT)');
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
