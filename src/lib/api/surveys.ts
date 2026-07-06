import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
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

/**
 * Multi-value answers (checkbox selections, ranking order) are stored as a
 * single string joined with this separator. Ranking answers are joined in
 * chosen order (first = rank 1).
 */
export const ANSWER_SEPARATOR = ' | ';

/** Has this survey's deadline passed? (No deadline = never closes.) */
export const surveyIsClosed = (s: Survey): boolean =>
  !!s.closesAt && s.closesAt.getTime() < Date.now();

/**
 * Responses are anonymous, so completion can't be tracked server-side without
 * defeating that. "Already took this" is remembered locally per account so a
 * refresh doesn't re-offer a submitted survey. Shared by the Surveys page and
 * the dashboard's "needs your attention" card.
 */
const completedKey = (uid: string) => `nmw-surveys-completed-${uid}`;
export const loadCompletedSurveys = (uid: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(completedKey(uid)) || '[]'));
  } catch {
    return new Set();
  }
};
export const saveCompletedSurveys = (uid: string, ids: Set<string>): void => {
  try {
    localStorage.setItem(completedKey(uid), JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — in-memory tracking still applies */
  }
};

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
  closesAt: data.closesAt?.toDate?.() || null,
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
      closesAt: data.closesAt ? Timestamp.fromDate(data.closesAt) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return ref.id;
  },

  update: async (id: string, data: Partial<Survey>): Promise<void> => {
    const patch: Record<string, unknown> = { ...data, updatedAt: Timestamp.now() };
    if ('closesAt' in data) {
      patch.closesAt = data.closesAt ? Timestamp.fromDate(data.closesAt) : null;
    }
    await updateDoc(doc(db, SURVEYS, id), cleanData(patch as any));
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
    // The admin-visible document is the source of truth: once this write
    // succeeds, the submission has succeeded.
    await addDoc(collection(db, RESPONSES), {
      surveyId: survey.id,
      answers,
      submittedAt: Timestamp.now(),
    });

    // The coach projection is best-effort. If it fails we must NOT surface an
    // error — the parent would resubmit and create a DUPLICATE response in the
    // admin collection, silently skewing every admin-side aggregate.
    try {
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
    } catch (err) {
      console.warn('[surveys] coach-visible projection write failed (admin copy saved):', err);
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

  /**
   * Coach-visible projection. When called by a coach, coachUid MUST be passed:
   * the security rule only allows reading docs where surveyCreatedBy == uid,
   * and Firestore rejects list queries that don't provably satisfy the rule —
   * so the query itself must carry the surveyCreatedBy filter.
   */
  getCoachVisibleBySurvey: async (surveyId: string, coachUid?: string): Promise<SurveyResponse[]> => {
    const q = coachUid
      ? query(
          collection(db, COACH_RESPONSES),
          where('surveyId', '==', surveyId),
          where('surveyCreatedBy', '==', coachUid)
        )
      : query(collection(db, COACH_RESPONSES), where('surveyId', '==', surveyId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => convertResponse(d.id, d.data()))
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  },

  /**
   * Response count for a survey without downloading the responses. Admins
   * count the full collection; coaches count their own coach-visible docs
   * (the extra surveyCreatedBy filter is what the security rules allow).
   */
  countBySurvey: async (surveyId: string, isAdmin: boolean, coachUid?: string): Promise<number> => {
    try {
      const q = isAdmin
        ? query(collection(db, RESPONSES), where('surveyId', '==', surveyId))
        : query(
            collection(db, COACH_RESPONSES),
            where('surveyId', '==', surveyId),
            where('surveyCreatedBy', '==', coachUid || '')
          );
      const snap = await getCountFromServer(q);
      return snap.data().count;
    } catch {
      return 0;
    }
  },
};
