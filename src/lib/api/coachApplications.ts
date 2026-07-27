import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const COLLECTION = 'coachApplications';

export type CoachApplicationStatus = 'new' | 'reviewing' | 'approved' | 'declined';

export interface CoachApplicationData {
  name: string;
  email: string;
  phone: string;
  location: string;
  ageGroupsInterested: string;
  coachingExperience: string;
  playingExperience: string;
  certifications: string; // SafeSport / CPR / coaching certs
  backgroundCheckConsent: boolean;
  availability: string;
  whyInterested: string;
}

export interface CoachApplication extends CoachApplicationData {
  id: string;
  status: CoachApplicationStatus;
  submittedAt: Date;
}

const convert = (id: string, data: any): CoachApplication => ({
  id,
  name: data.name || '',
  email: data.email || '',
  phone: data.phone || '',
  location: data.location || '',
  ageGroupsInterested: data.ageGroupsInterested || '',
  coachingExperience: data.coachingExperience || '',
  playingExperience: data.playingExperience || '',
  certifications: data.certifications || '',
  backgroundCheckConsent: !!data.backgroundCheckConsent,
  availability: data.availability || '',
  whyInterested: data.whyInterested || '',
  status: data.status || 'new',
  submittedAt: data.submittedAt?.toDate?.() || new Date(),
});

export const coachApplicationsApi = {
  /** Public: submit a coaching application */
  create: async (data: CoachApplicationData): Promise<string> => {
    const ref = await addDoc(collection(db, COLLECTION), {
      ...data,
      status: 'new',
      submittedAt: Timestamp.now(),
    });
    return ref.id;
  },

  /** Admin: all applications, newest first */
  getAll: async (): Promise<CoachApplication[]> => {
    const q = query(collection(db, COLLECTION), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => convert(d.id, d.data()));
  },

  updateStatus: async (id: string, status: CoachApplicationStatus): Promise<void> => {
    await updateDoc(doc(db, COLLECTION, id), { status });
  },
};
