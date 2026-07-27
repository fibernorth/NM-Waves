import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { format } from 'date-fns';

const COLLECTION = 'tryoutSessions';

/**
 * A tryout date/location option. Admins define one per session (e.g. two
 * Saturdays at different fields); families pick which one they'll attend.
 * ageGroups empty = open to all divisions.
 */
export interface TryoutSession {
  id: string;
  date: Date; // the day of the session
  startTime: string; // display string, e.g. "9:00 AM"
  endTime: string; // display string, e.g. "12:00 PM"
  location: string;
  ageGroups: string[];
  notes: string;
  active: boolean;
  createdAt: Date;
}

export interface TryoutSessionData {
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  ageGroups: string[];
  notes: string;
  active: boolean;
}

const convert = (id: string, data: any): TryoutSession => ({
  id,
  date: data.date?.toDate?.() || new Date(),
  startTime: data.startTime || '',
  endTime: data.endTime || '',
  location: data.location || '',
  ageGroups: data.ageGroups || [],
  notes: data.notes || '',
  active: data.active ?? true,
  createdAt: data.createdAt?.toDate?.() || new Date(),
});

/** One-line label used in pickers, emails, and the applicants grid. */
export const sessionLabel = (s: TryoutSession): string => {
  const day = format(s.date, 'EEE, MMM d');
  const time = s.startTime ? ` · ${s.startTime}${s.endTime ? `–${s.endTime}` : ''}` : '';
  const loc = s.location ? ` · ${s.location}` : '';
  return `${day}${time}${loc}`;
};

export const tryoutSessionsApi = {
  getAll: async (): Promise<TryoutSession[]> => {
    const q = query(collection(db, COLLECTION), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => convert(d.id, d.data()));
  },

  /** Active sessions whose day hasn't passed (today still counts). */
  getUpcoming: async (): Promise<TryoutSession[]> => {
    const all = await tryoutSessionsApi.getAll();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return all.filter((s) => s.active && s.date >= startOfToday);
  },

  create: async (data: TryoutSessionData): Promise<string> => {
    const ref = await addDoc(collection(db, COLLECTION), {
      ...data,
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return ref.id;
  },

  update: async (id: string, data: Partial<TryoutSessionData>): Promise<void> => {
    const patch: Record<string, unknown> = { ...data, updatedAt: Timestamp.now() };
    if (data.date) patch.date = Timestamp.fromDate(data.date);
    await updateDoc(doc(db, COLLECTION, id), patch);
  },

  remove: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTION, id));
  },
};
