import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Announcement } from '@/types/models';

const COLLECTION = 'announcements';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertAnnouncement = (id: string, data: any): Announcement => ({
  id,
  title: data.title,
  body: data.body,
  teamId: data.teamId,
  priority: data.priority,
  createdBy: data.createdBy,
  createdByName: data.createdByName || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  pinned: data.pinned ?? false,
});

export const announcementsApi = {
  getById: async (id: string): Promise<Announcement | null> => {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    return convertAnnouncement(docSnap.id, docSnap.data());
  },

  getAll: async (): Promise<Announcement[]> => {
    const q = query(
      collection(db, COLLECTION),
      orderBy('pinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertAnnouncement(d.id, d.data()));
  },

  getByTeam: async (teamId: string): Promise<Announcement[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('pinned', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertAnnouncement(d.id, d.data()));
  },

  create: async (
    data: Omit<Announcement, 'id' | 'createdAt'>
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...data,
      createdAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (
    id: string,
    data: Partial<Omit<Announcement, 'id' | 'createdAt'>>
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData({ ...data }));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  togglePin: async (id: string, pinned: boolean): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData({ pinned: !pinned }));
  },
};
