import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';

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
  sessionId?: string; // chosen tryout date (tryoutSessions doc id)
  sessionLabel?: string; // denormalized "Sat, Aug 9 · 9:00 AM · Twin Birch"
  playerId?: string; // set when registered by a parent for an existing player
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
  sessionId: data.sessionId || undefined,
  sessionLabel: data.sessionLabel || undefined,
  playerId: data.playerId || undefined,
  status: data.status || 'new',
  submittedAt: data.submittedAt?.toDate?.() || new Date(),
  convertedPlayerId: data.convertedPlayerId,
});

/** Strip undefined values so Firestore accepts the write. */
const clean = <T extends Record<string, unknown>>(obj: T): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
};

export const tryoutApplicantsApi = {
  /** Public: submit a new tryout registration */
  create: async (data: TryoutApplicantData): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), clean({
      ...data,
      submittedAt: Timestamp.now(),
      status: 'new',
    }));
    return docRef.id;
  },

  /**
   * Signed-in parent: registrations created with their email. The email
   * equality filter is required — the security rule only grants parents read
   * access to docs whose email matches their own sign-in email.
   */
  getByEmail: async (email: string): Promise<TryoutApplicant[]> => {
    const q = query(collection(db, COLLECTION), where('email', '==', email));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => convertApplicant(d.id, d.data()))
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  },

  /** Parent (own registration, enforced by rules) or coach: edit a registration. */
  updateDetails: async (id: string, data: Partial<TryoutApplicantData>): Promise<void> => {
    await updateDoc(doc(db, COLLECTION, id), clean({ ...data }));
  },

  /** Coach/admin: all applicants, newest first */
  getAll: async (): Promise<TryoutApplicant[]> => {
    const q = query(collection(db, COLLECTION), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => convertApplicant(d.id, d.data()));
  },

  /**
   * Coach/admin: send the branded offer email to the applicant's family and
   * mark them invited (status is set server-side by the callable).
   */
  sendOffer: async (applicantId: string): Promise<{ sent: boolean; email: string }> => {
    const callable = httpsCallable<{ applicantId: string }, { sent: boolean; email: string }>(
      functions,
      'sendTryoutOffer'
    );
    const res = await callable({ applicantId });
    return res.data;
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
