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
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Scholarship } from '@/types/models';

/**
 * Recalculate and update the total scholarshipAmount on the player's finance record.
 */
async function syncScholarshipAmount(playerId: string): Promise<void> {
  const scholarshipsQuery = query(
    collection(db, 'scholarships'),
    where('playerId', '==', playerId)
  );
  const snapshot = await getDocs(scholarshipsQuery);
  const totalAmount = snapshot.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

  // Find the player's most recent finance record
  const financeQuery = query(
    collection(db, 'playerFinances'),
    where('playerId', '==', playerId)
  );
  const financeSnap = await getDocs(financeQuery);
  for (const financeDoc of financeSnap.docs) {
    await updateDoc(financeDoc.ref, {
      scholarshipAmount: totalAmount,
      updatedAt: Timestamp.now(),
    });
  }
}

const COLLECTION = 'scholarships';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

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

  // Create scholarship and sync finance record
  create: async (scholarshipData: Omit<Scholarship, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...scholarshipData,
      approvedAt: Timestamp.fromDate(scholarshipData.approvedAt),
    }));
    await syncScholarshipAmount(scholarshipData.playerId);
    return docRef.id;
  },

  // Update scholarship and sync finance record
  update: async (id: string, scholarshipData: Partial<Scholarship>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...scholarshipData };
    if (scholarshipData.approvedAt) {
      updateData.approvedAt = Timestamp.fromDate(scholarshipData.approvedAt);
    }
    delete updateData.id;
    await updateDoc(docRef, cleanData(updateData));
    // Need to find the playerId to sync — read the scholarship if not provided
    if (scholarshipData.playerId) {
      await syncScholarshipAmount(scholarshipData.playerId);
    }
  },

  // Delete scholarship and sync finance record
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const scholarshipSnap = await getDoc(docRef);
    const playerId = scholarshipSnap.data()?.playerId;
    await deleteDoc(docRef);
    if (playerId) {
      await syncScholarshipAmount(playerId);
    }
  },
};
