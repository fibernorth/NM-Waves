import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage } from '@/lib/firebase/config';
import { functions } from '@/lib/firebase/config';
import type { MediaItem } from '@/types/models';
import { isResizableImage, resizeImage, generateThumbnail } from '@/lib/utils/imageResize';

const COLLECTION = 'media';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'wmv', 'flv', 'm4v'];

const detectMediaType = (fileName: string): 'image' | 'video' => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'image';
};

const convertMediaItem = (id: string, data: any): MediaItem => ({
  id,
  fileUrl: data.fileUrl,
  thumbnailUrl: data.thumbnailUrl || undefined,
  fileName: data.fileName || undefined,
  teamId: data.teamId,
  teamName: data.teamName || undefined,
  uploadedBy: data.uploadedBy,
  uploadedByName: data.uploadedByName || undefined,
  tags: data.tags || [],
  caption: data.caption || undefined,
  mediaType: data.mediaType || 'image',
  moderationStatus: data.moderationStatus || undefined,
  moderationLabels: data.moderationLabels || undefined,
  moderationReviewedAt: data.moderationReviewedAt?.toDate() || undefined,
  moderationOverriddenBy: data.moderationOverriddenBy || undefined,
  source: data.source || undefined,
  detectedText: data.detectedText || undefined,
  detectedLabels: data.detectedLabels || undefined,
  detectedJerseyNumbers: data.detectedJerseyNumbers || undefined,
  suggestedPlayerIds: data.suggestedPlayerIds || undefined,
  suggestedPlayerNames: data.suggestedPlayerNames || undefined,
  suggestedTeamId: data.suggestedTeamId || undefined,
  photoDate: data.photoDate?.toDate() || undefined,
  analysisStatus: data.analysisStatus || undefined,
  showInGallery: data.showInGallery ?? false,
  createdAt: data.createdAt?.toDate() || new Date(),
});

export const mediaApi = {
  // Get all media ordered by createdAt desc
  getAll: async (): Promise<MediaItem[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertMediaItem(d.id, d.data()));
  },

  // Get media by team
  getByTeam: async (teamId: string): Promise<MediaItem[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertMediaItem(d.id, d.data()));
  },

  // Create media item
  create: async (data: Omit<MediaItem, 'id' | 'createdAt'>): Promise<string> => {
    const moderationStatus = data.mediaType === 'video' ? 'approved' : 'pending';
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...data,
      moderationStatus,
      createdAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  // Delete media item
  delete: async (id: string, fileUrl?: string): Promise<void> => {
    // Attempt to delete the file from storage if URL is provided
    if (fileUrl) {
      try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
      } catch {
        // File may not exist in storage or URL may be external; continue with doc deletion
      }
    }
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  // Upload media file to Firebase Storage and return download URL
  uploadMedia: async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; thumbnailUrl?: string; fileName: string; mediaType: 'image' | 'video' }> => {
    const timestamp = Date.now();
    const mediaType = detectMediaType(file.name);

    if (onProgress) onProgress(5);

    // Resize image if applicable
    let fileToUpload = file;
    if (isResizableImage(file)) {
      fileToUpload = await resizeImage(file, { maxDimension: 1920, quality: 0.85 });
    }

    if (onProgress) onProgress(15);

    const storagePath = `media/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, fileToUpload);

    if (onProgress) onProgress(60);

    const url = await getDownloadURL(storageRef);

    // Generate and upload thumbnail for images
    let thumbnailUrl: string | undefined;
    if (isResizableImage(file)) {
      try {
        const thumb = await generateThumbnail(file, 400);
        const thumbPath = `media/thumbs/${timestamp}_${file.name}`;
        const thumbRef = ref(storage, thumbPath);
        await uploadBytes(thumbRef, thumb);
        thumbnailUrl = await getDownloadURL(thumbRef);
      } catch {
        // Thumbnail generation failed; continue without it
      }
    }

    if (onProgress) onProgress(100);

    return {
      url,
      thumbnailUrl,
      fileName: file.name,
      mediaType,
    };
  },

  // Update a single media item's fields
  update: async (id: string, updates: Partial<Pick<MediaItem, 'tags' | 'showInGallery' | 'caption'>>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData(updates as Record<string, unknown>));
  },

  // Bulk update multiple media items (team, tags)
  bulkUpdate: async (
    ids: string[],
    updates: { teamId?: string; teamName?: string; tags?: string[] }
  ): Promise<void> => {
    const { writeBatch } = await import('firebase/firestore');
    const BATCH_LIMIT = 400;
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + BATCH_LIMIT);
      const cleaned = cleanData(updates as Record<string, unknown>);
      for (const id of chunk) {
        const docRef = doc(db, COLLECTION, id);
        batch.update(docRef, cleaned);
      }
      await batch.commit();
    }
  },

  // Admin override of moderation status
  overrideModeration: async (
    id: string,
    status: 'approved' | 'rejected',
    overriddenBy: string
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData({
      moderationStatus: status,
      moderationOverriddenBy: overriddenBy,
      moderationReviewedAt: Timestamp.now(),
    }));
  },

  // Trigger batch analysis of unanalyzed media via Cloud Function
  triggerBatchAnalysis: async (
    batchSize = 50
  ): Promise<{ total: number; processed: number; failed: number }> => {
    const callable = httpsCallable<{ batchSize: number }, { total: number; processed: number; failed: number }>(
      functions,
      'batchAnalyzeMedia'
    );
    const result = await callable({ batchSize });
    return result.data;
  },

  // Accept suggested tags/team/player from analysis
  acceptSuggestions: async (
    id: string,
    updates: {
      teamId?: string;
      teamName?: string;
      tags?: string[];
      playerIds?: string[];
      playerNames?: string[];
    }
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: Record<string, unknown> = {};
    if (updates.teamId) {
      updateData.teamId = updates.teamId;
      if (updates.teamName) updateData.teamName = updates.teamName;
    }
    if (updates.tags && updates.tags.length > 0) {
      updateData.tags = updates.tags;
    }
    if (updates.playerIds) {
      updateData.taggedPlayerIds = updates.playerIds;
      updateData.taggedPlayerNames = updates.playerNames || [];
    }
    if (Object.keys(updateData).length > 0) {
      await updateDoc(docRef, cleanData(updateData));
    }
  },
};
