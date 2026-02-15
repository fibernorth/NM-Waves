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

const COLLECTION = 'documents';

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
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // Update document
  update: async (id: string, data: Partial<AppDocument>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const { id: _id, createdAt: _createdAt, ...updateData } = data as any;
    await updateDoc(docRef, updateData);
  },

  // Delete document
  delete: async (id: string, fileURL?: string): Promise<void> => {
    // Attempt to delete the file from storage if URL is provided
    if (fileURL) {
      try {
        const fileRef = ref(storage, fileURL);
        await deleteObject(fileRef);
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

    await uploadBytes(storageRef, file);

    if (onProgress) onProgress(80);

    const url = await getDownloadURL(storageRef);

    if (onProgress) onProgress(100);

    return {
      url,
      fileName: file.name,
      fileSize: file.size,
    };
  },
};
