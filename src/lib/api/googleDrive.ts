import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';
import type { MediaItem } from '@/types/models';

interface DrivePhoto {
  id: string;
  name: string;
  thumbnailUrl?: string;
  fileUrl: string;
  createdAt: string;
  source: 'google_drive';
}

/**
 * Fetch photos from Google Drive via Cloud Function callable.
 * Returns items shaped like MediaItem for easy merging with Firebase media.
 */
export const googleDriveApi = {
  listPhotos: async (): Promise<MediaItem[]> => {
    const callable = httpsCallable<void, { photos: DrivePhoto[] }>(functions, 'listDrivePhotos');
    const result = await callable();
    const photos = result.data.photos || [];

    return photos.map((photo) => ({
      id: photo.id,
      fileUrl: photo.fileUrl,
      thumbnailUrl: photo.thumbnailUrl,
      fileName: photo.name,
      teamId: 'all',
      uploadedBy: 'google_drive',
      tags: [],
      mediaType: 'image' as const,
      moderationStatus: 'approved' as const,
      source: 'google_drive' as const,
      createdAt: new Date(photo.createdAt),
    }));
  },
};
