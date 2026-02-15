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
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Scholarship } from '@/types/models';

const COLLECTION = 'scholarships';

const convertScholarship = (id: string, data: any): Scholarship => ({
  id,
  playerId: data.playerId,
  playerName: data.playerName || '',
  amount: data.amount,
  reason: data.reason,
  approvedBy: data.approvedBy,
  approvedAt: data.approvedAt?.toDate() || new Date(),
});

export const scholarshipsApi = {
  // Get all scholarships
  getAll: async (): Promise<Scholarship[]> => {
    const q = query(collection(db, COLLECTION), orderBy('approvedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertScholarship(doc.id, doc.data()));
  },

  // Get scholarships by player
  getByPlayer: async (playerId: string): Promise<Scholarship[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('playerId', '==', playerId),
      orderBy('approvedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertScholarship(doc.id, doc.data()));
  },

  // Create scholarship
  create: async (scholarshipData: Omit<Scholarship, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...scholarshipData,
      approvedAt: Timestamp.fromDate(scholarshipData.approvedAt),
    });
    return docRef.id;
  },

  // Update scholarship
  update: async (id: string, scholarshipData: Partial<Scholarship>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...scholarshipData };
    if (scholarshipData.approvedAt) {
      updateData.approvedAt = Timestamp.fromDate(scholarshipData.approvedAt);
    }
    delete updateData.id;
    await updateDoc(docRef, updateData);
  },

  // Delete scholarship
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },
};
