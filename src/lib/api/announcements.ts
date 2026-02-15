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
import { db } from '@/lib/firebase/config';
import type { Announcement } from '@/types/models';

const COLLECTION = 'announcements';

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
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  update: async (
    id: string,
    data: Partial<Omit<Announcement, 'id' | 'createdAt'>>
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { ...data });
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  togglePin: async (id: string, pinned: boolean): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { pinned: !pinned });
  },
};
