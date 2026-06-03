import {
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const COLLECTION = 'tryout-applicants';

export interface TryoutApplicantData {
  playerFirstName: string;
  playerLastName: string;
  dateOfBirth: string;
  ageGroup: string;
  parentName: string;
  email: string;
  phone: string;
  positionsInterested: string;
  priorExperience: string;
}

export const tryoutApplicantsApi = {
  /** Submit a new tryout registration */
  create: async (data: TryoutApplicantData): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      submittedAt: Timestamp.now(),
      status: 'new',
    });
    return docRef.id;
  },
};
