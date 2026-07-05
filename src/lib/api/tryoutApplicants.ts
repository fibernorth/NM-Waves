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

const COLLECTION = 'tryout-applicants';

export type TryoutStatus = 'new' | 'evaluated' | 'invited' | 'declined' | 'converted';

export interface TryoutApplicantData {
  playerFirstName: string;
  playerLastName: string;
  dateOfBirth: string;
  ageGroup: string;
  location: string; // city/town — coaches use this to gauge travel distance
  parentName: string;
  email: string;
  phone: string;
  positionsInterested: string;
  priorExperience: string;
}

export interface TryoutApplicant extends TryoutApplicantData {
  id: string;
  status: TryoutStatus;
  submittedAt: Date;
  convertedPlayerId?: string;
}

export interface TryoutEvaluation {
  id: string;
  evaluatorId: string;
  evaluatorName: string;
  overallRating: number; // 1-5
  hitting?: number;
  fielding?: number;
  throwing?: number;
  speed?: number;
  notes: string;
  createdAt: Date;
}

const convertApplicant = (id: string, data: any): TryoutApplicant => ({
  id,
  playerFirstName: data.playerFirstName || '',
  playerLastName: data.playerLastName || '',
  dateOfBirth: data.dateOfBirth || '',
  ageGroup: data.ageGroup || '',
  location: data.location || '',
  parentName: data.parentName || '',
  email: data.email || '',
  phone: data.phone || '',
  positionsInterested: data.positionsInterested || '',
  priorExperience: data.priorExperience || '',
  status: data.status || 'new',
  submittedAt: data.submittedAt?.toDate?.() || new Date(),
  convertedPlayerId: data.convertedPlayerId,
});

export const tryoutApplicantsApi = {
  /** Public: submit a new tryout registration */
  create: async (data: TryoutApplicantData): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      submittedAt: Timestamp.now(),
      status: 'new',
    });
    return docRef.id;
  },

  /** Coach/admin: all applicants, newest first */
  getAll: async (): Promise<TryoutApplicant[]> => {
    const q = query(collection(db, COLLECTION), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => convertApplicant(d.id, d.data()));
  },

  updateStatus: async (id: string, status: TryoutStatus, convertedPlayerId?: string): Promise<void> => {
    const patch: Record<string, unknown> = { status };
    if (convertedPlayerId) patch.convertedPlayerId = convertedPlayerId;
    await updateDoc(doc(db, COLLECTION, id), patch);
  },

  // --- Evaluations (subcollection; coach-readable/writable per firestore.rules) ---
  getEvaluations: async (applicantId: string): Promise<TryoutEvaluation[]> => {
    const snap = await getDocs(collection(db, COLLECTION, applicantId, 'evaluations'));
    return snap.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          evaluatorId: data.evaluatorId || '',
          evaluatorName: data.evaluatorName || '',
          overallRating: data.overallRating || 0,
          hitting: data.hitting,
          fielding: data.fielding,
          throwing: data.throwing,
          speed: data.speed,
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as TryoutEvaluation;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  addEvaluation: async (
    applicantId: string,
    evaluation: Omit<TryoutEvaluation, 'id' | 'createdAt'>
  ): Promise<void> => {
    await addDoc(collection(db, COLLECTION, applicantId, 'evaluations'), {
      ...evaluation,
      createdAt: Timestamp.now(),
    });
  },
};
