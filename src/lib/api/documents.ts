import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type { AppDocument } from '@/types/models';
import { isResizableImage, resizeImage } from '@/lib/utils/imageResize';

const COLLECTION = 'documents';

/**
 * Extract the storage path from a Firebase download URL.
 * Download URLs contain the path encoded between /o/ and ?
 */
function storagePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (match) return decodeURIComponent(match[1]);
  } catch { /* not a Firebase URL */ }
  return null;
}

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertDocument = (id: string, data: any): AppDocument => ({
  id,
  title: data.title,
  description: data.description || undefined,
  fileURL: data.fileURL,
  fileName: data.fileName || undefined,
  fileSize: data.fileSize || undefined,
  teamId: data.teamId,
  visibility: data.visibility,
  uploadedBy: data.uploadedBy,
  uploadedByName: data.uploadedByName || undefined,
  category: data.category || undefined,
  createdAt: data.createdAt?.toDate() || new Date(),
});

export const documentsApi = {
  // Get all documents ordered by createdAt desc
  getAll: async (): Promise<AppDocument[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertDocument(d.id, d.data()));
  },

  // Get documents by team
  getByTeam: async (teamId: string): Promise<AppDocument[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertDocument(d.id, d.data()));
  },

  // Get documents filtered by user roles
  getForRoles: async (roles: string[]): Promise<AppDocument[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const allDocs = snapshot.docs.map((d) => convertDocument(d.id, d.data()));

    // Filter based on role visibility (highest privilege wins)
    return allDocs.filter((doc) => {
      if (roles.includes('admin') || roles.includes('master-admin')) return true;
      if (roles.includes('coach')) return ['public', 'parent', 'coach', 'team'].includes(doc.visibility);
      if (roles.includes('parent')) return ['public', 'parent'].includes(doc.visibility);
      return doc.visibility === 'public';
    });
  },

  // Get documents by visibility
  getByVisibility: async (visibility: 'public' | 'parent' | 'coach' | 'team' | 'admin'): Promise<AppDocument[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('visibility', '==', visibility),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertDocument(d.id, d.data()));
  },

  // Create document
  create: async (
    data: Omit<AppDocument, 'id' | 'createdAt'>
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...data,
      createdAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  // Update document
  update: async (id: string, data: Partial<AppDocument>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const { id: _id, createdAt: _createdAt, ...updateData } = data as any;
    await updateDoc(docRef, cleanData(updateData));
  },

  // Delete document
  delete: async (id: string, fileURL?: string): Promise<void> => {
    // Attempt to delete the file from storage if URL is provided
    if (fileURL) {
      try {
        const storagePath = storagePathFromUrl(fileURL);
        if (storagePath) {
          const fileRef = ref(storage, storagePath);
          await deleteObject(fileRef);
        }
      } catch {
        // File may not exist in storage or URL may be external; continue with doc deletion
      }
    }
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  // Upload file to Firebase Storage and return download URL
  uploadFile: async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; fileName: string; fileSize: number }> => {
    const timestamp = Date.now();
    const storagePath = `documents/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    // uploadBytes does not support progress natively, so we signal start/end
    if (onProgress) onProgress(10);

    // Resize images before upload (skip PDFs/docs)
    let fileToUpload = file;
    if (isResizableImage(file)) {
      fileToUpload = await resizeImage(file, { maxDimension: 1920, quality: 0.85 });
    }

    await uploadBytes(storageRef, fileToUpload);

    if (onProgress) onProgress(80);

    const url = await getDownloadURL(storageRef);

    if (onProgress) onProgress(100);

    return {
      url,
      fileName: file.name,
      fileSize: fileToUpload.size,
    };
  },
};
