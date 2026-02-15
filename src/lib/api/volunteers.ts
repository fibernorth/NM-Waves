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
import type { Volunteer } from '@/types/models';

const COLLECTION = 'volunteers';

const convertVolunteer = (id: string, data: any): Volunteer => ({
  id,
  eventId: data.eventId,
  eventTitle: data.eventTitle,
  teamId: data.teamId,
  teamName: data.teamName,
  role: data.role,
  assignedTo: data.assignedTo,
  assignedToName: data.assignedToName,
  status: data.status,
  createdAt: data.createdAt?.toDate() || new Date(),
});

export const volunteersApi = {
  getAll: async (): Promise<Volunteer[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertVolunteer(d.id, d.data()));
  },

  getByEvent: async (eventId: string): Promise<Volunteer[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('eventId', '==', eventId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertVolunteer(d.id, d.data()));
  },

  getByTeam: async (teamId: string): Promise<Volunteer[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertVolunteer(d.id, d.data()));
  },

  create: async (
    volunteerData: Omit<Volunteer, 'id' | 'createdAt'>
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...volunteerData,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  update: async (
    id: string,
    volunteerData: Partial<Volunteer>
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...volunteerData };
    delete updateData.id;
    delete updateData.createdAt;
    await updateDoc(docRef, updateData);
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  updateStatus: async (
    id: string,
    status: Volunteer['status']
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { status });
  },
};
