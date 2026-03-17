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
import type { PlayerMetric } from '@/types/models';

const COLLECTION = 'playerMetrics';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertMetric = (id: string, data: any): PlayerMetric => ({
  id,
  playerId: data.playerId,
  playerName: data.playerName || '',
  metricType: data.metricType,
  value: data.value,
  unit: data.unit,
  date: data.date?.toDate() || new Date(),
  recordedBy: data.recordedBy,
});

export const metricsApi = {
  // Get all metrics
  getAll: async (): Promise<PlayerMetric[]> => {
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertMetric(doc.id, doc.data()));
  },

  // Get metrics by player
  getByPlayer: async (playerId: string): Promise<PlayerMetric[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('playerId', '==', playerId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertMetric(doc.id, doc.data()));
  },

  // Create metric
  create: async (metricData: Omit<PlayerMetric, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...metricData,
      date: Timestamp.fromDate(metricData.date),
    }));
    return docRef.id;
  },

  // Update metric
  update: async (id: string, metricData: Partial<PlayerMetric>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...metricData };
    if (metricData.date) {
      updateData.date = Timestamp.fromDate(metricData.date);
    }
    delete updateData.id;
    await updateDoc(docRef, cleanData(updateData));
  },

  // Delete metric
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },
};
