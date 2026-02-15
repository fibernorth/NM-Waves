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
import type { Tournament } from '@/types/models';

const COLLECTION = 'tournaments';

const convertTournament = (id: string, data: any): Tournament => ({
  id,
  name: data.name,
  location: data.location,
  startDate: data.startDate?.toDate() || new Date(),
  endDate: data.endDate?.toDate() || new Date(),
  teamIds: data.teamIds || [],
  contact: data.contact || '',
  notes: data.notes || '',
  cost: data.cost || 0,
  status: data.status || 'upcoming',
});

export const tournamentsApi = {
  getAll: async (): Promise<Tournament[]> => {
    const q = query(collection(db, COLLECTION), orderBy('startDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertTournament(doc.id, doc.data()));
  },

  getUpcoming: async (): Promise<Tournament[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'upcoming'),
      orderBy('startDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertTournament(doc.id, doc.data()));
  },

  create: async (data: Omit<Tournament, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
    });
    return docRef.id;
  },

  update: async (id: string, data: Partial<Tournament>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...data };
    if (data.startDate) {
      updateData.startDate = Timestamp.fromDate(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = Timestamp.fromDate(data.endDate);
    }
    await updateDoc(docRef, updateData);
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },
};
