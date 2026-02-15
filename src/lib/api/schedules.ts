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
import type { ScheduleEvent } from '@/types/models';

const COLLECTION = 'schedules';

const convertEvent = (id: string, data: any): ScheduleEvent => ({
  id,
  eventType: data.eventType,
  teamId: data.teamId,
  teamName: data.teamName,
  title: data.title,
  location: data.location,
  startTime: data.startTime?.toDate() || new Date(),
  endTime: data.endTime?.toDate() || new Date(),
  notes: data.notes,
  createdBy: data.createdBy,
});

export const schedulesApi = {
  getAll: async (): Promise<ScheduleEvent[]> => {
    const q = query(collection(db, COLLECTION), orderBy('startTime', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEvent(d.id, d.data()));
  },

  getByTeam: async (teamId: string): Promise<ScheduleEvent[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('startTime', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEvent(d.id, d.data()));
  },

  getUpcoming: async (): Promise<ScheduleEvent[]> => {
    const now = Timestamp.now();
    const q = query(
      collection(db, COLLECTION),
      where('startTime', '>=', now),
      orderBy('startTime', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEvent(d.id, d.data()));
  },

  create: async (
    eventData: Omit<ScheduleEvent, 'id'>
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...eventData,
      startTime: Timestamp.fromDate(
        eventData.startTime instanceof Date
          ? eventData.startTime
          : new Date(eventData.startTime)
      ),
      endTime: Timestamp.fromDate(
        eventData.endTime instanceof Date
          ? eventData.endTime
          : new Date(eventData.endTime)
      ),
    });
    return docRef.id;
  },

  update: async (
    id: string,
    eventData: Partial<ScheduleEvent>
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...eventData };
    if (eventData.startTime) {
      updateData.startTime = Timestamp.fromDate(
        eventData.startTime instanceof Date
          ? eventData.startTime
          : new Date(eventData.startTime)
      );
    }
    if (eventData.endTime) {
      updateData.endTime = Timestamp.fromDate(
        eventData.endTime instanceof Date
          ? eventData.endTime
          : new Date(eventData.endTime)
      );
    }
    delete updateData.id;
    await updateDoc(docRef, updateData);
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },
};
