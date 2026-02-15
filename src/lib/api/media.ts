import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type { MediaItem } from '@/types/models';

const COLLECTION = 'media';

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
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
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
  ): Promise<{ url: string; fileName: string; mediaType: 'image' | 'video' }> => {
    const timestamp = Date.now();
    const storagePath = `media/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    if (onProgress) onProgress(10);

    await uploadBytes(storageRef, file);

    if (onProgress) onProgress(80);

    const url = await getDownloadURL(storageRef);

    if (onProgress) onProgress(100);

    return {
      url,
      fileName: file.name,
      mediaType: detectMediaType(file.name),
    };
  },
};
