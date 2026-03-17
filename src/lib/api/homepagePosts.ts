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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type { HomepagePost } from '@/types/models';
import { isResizableImage, resizeImage } from '@/lib/utils/imageResize';

const COLLECTION = 'homepagePosts';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertPost = (id: string, data: any): HomepagePost => ({
  id,
  type: data.type,
  title: data.title,
  body: data.body || undefined,
  imageUrl: data.imageUrl || undefined,
  videoUrl: data.videoUrl || undefined,
  teamId: data.teamId || undefined,
  teamName: data.teamName || undefined,
  opponent: data.opponent || undefined,
  scoreUs: data.scoreUs ?? undefined,
  scoreThem: data.scoreThem ?? undefined,
  gameDate: data.gameDate?.toDate() || undefined,
  result: data.result || undefined,
  statHighlights: data.statHighlights || undefined,
  pinned: data.pinned ?? false,
  published: data.published ?? true,
  createdBy: data.createdBy,
  createdByName: data.createdByName || undefined,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const homepagePostsApi = {
  getAll: async (): Promise<HomepagePost[]> => {
    const q = query(
      collection(db, COLLECTION),
      orderBy('pinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertPost(d.id, d.data()));
  },

  getPublished: async (): Promise<HomepagePost[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('published', '==', true),
      orderBy('pinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertPost(d.id, d.data()));
  },

  create: async (data: Omit<HomepagePost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const payload: any = { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    if (data.gameDate) {
      payload.gameDate = Timestamp.fromDate(data.gameDate);
    }
    const docRef = await addDoc(collection(db, COLLECTION), cleanData(payload));
    return docRef.id;
  },

  update: async (id: string, data: Partial<Omit<HomepagePost, 'id' | 'createdAt'>>): Promise<void> => {
    const payload: any = { ...data, updatedAt: Timestamp.now() };
    if (data.gameDate) {
      payload.gameDate = Timestamp.fromDate(data.gameDate);
    }
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData(payload));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  togglePin: async (id: string, currentPinned: boolean): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { pinned: !currentPinned, updatedAt: Timestamp.now() });
  },

  togglePublish: async (id: string, currentPublished: boolean): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { published: !currentPublished, updatedAt: Timestamp.now() });
  },

  uploadImage: async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const storagePath = `homepage/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    // Resize image before upload if applicable
    let fileToUpload = file;
    if (isResizableImage(file)) {
      fileToUpload = await resizeImage(file, { maxDimension: 1920, quality: 0.85 });
    }

    await uploadBytes(storageRef, fileToUpload);
    return await getDownloadURL(storageRef);
  },
};
