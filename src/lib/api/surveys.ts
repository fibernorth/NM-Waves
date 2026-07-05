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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Survey, SurveyResponse, SurveyQuestion, SurveyAnswer } from '@/types/models';

const SURVEYS = 'surveys';
const RESPONSES = 'surveyResponses';

const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
};

const convertSurvey = (id: string, data: any): Survey => ({
  id,
  title: data.title || '',
  description: data.description || '',
  questions: (data.questions || []) as SurveyQuestion[],
  active: data.active ?? false,
  anonymous: data.anonymous ?? true,
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate?.() || new Date(),
  updatedAt: data.updatedAt?.toDate?.() || new Date(),
});

const convertResponse = (id: string, data: any): SurveyResponse => ({
  id,
  surveyId: data.surveyId,
  answers: (data.answers || []) as SurveyAnswer[],
  submittedAt: data.submittedAt?.toDate?.() || new Date(),
});

export const surveysApi = {
  // Admin: all surveys (newest first)
  getAll: async (): Promise<Survey[]> => {
    const q = query(collection(db, SURVEYS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => convertSurvey(d.id, d.data()));
  },

  // Active surveys (for parents to fill out)
  getActive: async (): Promise<Survey[]> => {
    const q = query(collection(db, SURVEYS), where('active', '==', true), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => convertSurvey(d.id, d.data()));
  },

  getById: async (id: string): Promise<Survey | null> => {
    const snap = await getDoc(doc(db, SURVEYS, id));
    return snap.exists() ? convertSurvey(snap.id, snap.data()) : null;
  },

  create: async (data: Omit<Survey, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, SURVEYS), cleanData({
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return ref.id;
  },

  update: async (id: string, data: Partial<Survey>): Promise<void> => {
    await updateDoc(doc(db, SURVEYS, id), cleanData({ ...data, updatedAt: Timestamp.now() }));
  },

  remove: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, SURVEYS, id));
  },
};

export const surveyResponsesApi = {
  // Anyone signed in can submit a response (anonymous — no identity stored).
  submit: async (surveyId: string, answers: SurveyAnswer[]): Promise<void> => {
    await addDoc(collection(db, RESPONSES), {
      surveyId,
      answers,
      submittedAt: Timestamp.now(),
    });
  },

  // Admin only (enforced by Firestore rules — coaches cannot read).
  getBySurvey: async (surveyId: string): Promise<SurveyResponse[]> => {
    const q = query(collection(db, RESPONSES), where('surveyId', '==', surveyId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => convertResponse(d.id, d.data()))
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  },
};
