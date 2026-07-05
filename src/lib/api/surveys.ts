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
const COACH_RESPONSES = 'surveyResponsesCoach';

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
  assignedTeamIds: data.assignedTeamIds || [],
  assignedPlayerIds: data.assignedPlayerIds || [],
  createdBy: data.createdBy || '',
  createdByRole: data.createdByRole,
  createdAt: data.createdAt?.toDate?.() || new Date(),
  updatedAt: data.updatedAt?.toDate?.() || new Date(),
});

const convertResponse = (id: string, data: any): SurveyResponse => ({
  id,
  surveyId: data.surveyId,
  answers: (data.answers || []) as SurveyAnswer[],
  submittedAt: data.submittedAt?.toDate?.() || new Date(),
  surveyCreatedBy: data.surveyCreatedBy,
});

/** Is this survey targeted at a parent whose children are on these teams / are these player ids? */
export const surveyMatchesAudience = (
  s: Survey,
  childTeamIds: string[],
  childPlayerIds: string[]
): boolean => {
  if ((s.assignedTeamIds?.length || 0) === 0 && (s.assignedPlayerIds?.length || 0) === 0) return true;
  if (s.assignedTeamIds?.some((t) => childTeamIds.includes(t))) return true;
  if (s.assignedPlayerIds?.some((p) => childPlayerIds.includes(p))) return true;
  return false;
};

export const surveysApi = {
  getAll: async (): Promise<Survey[]> => {
    const q = query(collection(db, SURVEYS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => convertSurvey(d.id, d.data()));
  },

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
  /**
   * Submit a response. Writes the full answer set to the admin-only collection,
   * and (if the survey has any coach-visible questions) a projection with only
   * those answers to the coach-visible collection, tagged with the survey's
   * creator so that creator (a coach) may read it.
   */
  submit: async (survey: Survey, answers: SurveyAnswer[]): Promise<void> => {
    await addDoc(collection(db, RESPONSES), {
      surveyId: survey.id,
      answers,
      submittedAt: Timestamp.now(),
    });

    const coachVisibleIds = new Set(
      survey.questions.filter((q) => q.visibleToCoaches).map((q) => q.id)
    );
    if (coachVisibleIds.size > 0) {
      const coachAnswers = answers.filter((a) => coachVisibleIds.has(a.questionId));
      await addDoc(collection(db, COACH_RESPONSES), {
        surveyId: survey.id,
        surveyCreatedBy: survey.createdBy,
        answers: coachAnswers,
        submittedAt: Timestamp.now(),
      });
    }
  },

  // Admin only (Firestore rules): full responses.
  getBySurvey: async (surveyId: string): Promise<SurveyResponse[]> => {
    const q = query(collection(db, RESPONSES), where('surveyId', '==', surveyId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => convertResponse(d.id, d.data()))
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  },

  // Coach-visible projection (admin, or the survey's creator coach).
  getCoachVisibleBySurvey: async (surveyId: string): Promise<SurveyResponse[]> => {
    const q = query(collection(db, COACH_RESPONSES), where('surveyId', '==', surveyId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => convertResponse(d.id, d.data()))
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  },
};
