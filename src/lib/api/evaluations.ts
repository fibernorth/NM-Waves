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

/**
 * Evaluation system (SkillShark-style), built for tryouts AND ongoing
 * player evaluations:
 *   evalTemplates — weighted categories → skills with a scoring scale
 *   evalEvents    — a tryout/camp/mid-season session: template snapshot,
 *                   stations, participants (applicants or rostered players),
 *                   check-in, jersey/pinnie numbers
 *   evalInvites   — tokened guest-evaluator links (scored via Cloud Functions)
 *   evalScores    — one doc per skill score: value, comment, media, evaluator
 */

// ---------- Types ----------

export type ScoreScale = 5 | 10;

export interface EvalSkill {
  id: string;
  name: string;
  description?: string;
  weight: number; // relative weight within the template (default 1)
  scale: ScoreScale;
}

export interface EvalCategory {
  id: string;
  name: string;
  skills: EvalSkill[];
}

export interface EvalTemplate {
  id: string;
  name: string;
  categories: EvalCategory[];
  createdBy: string;
  createdAt: Date;
}

export interface EvalStation {
  id: string;
  name: string;
  skillIds: string[];
  location?: string;
  notes?: string;
}

export type EvalEventType = 'tryout' | 'camp' | 'practice' | 'midseason';
export type EvalEventStatus = 'draft' | 'open' | 'closed';

export interface EvalParticipant {
  id: string;
  name: string;
  number: string; // jersey / pinnie number for fast scoring
  division?: string;
  group?: string;
  checkedIn: boolean;
  playerId?: string; // rostered player (enables progress over time)
  applicantId?: string; // tryout applicant source
}

export interface EvalEvent {
  id: string;
  name: string;
  date: Date;
  type: EvalEventType;
  status: EvalEventStatus;
  templateName: string;
  categories: EvalCategory[]; // snapshot — template edits never corrupt history
  stations: EvalStation[];
  participants: EvalParticipant[];
  season?: string; // tryout events are tied to a season for auto-linking
  createdBy: string;
  createdAt: Date;
}

export interface EvalInvite {
  id: string;
  token: string;
  eventId: string;
  evaluatorName: string;
  active: boolean;
  createdAt: Date;
}

export interface EvalScore {
  id: string;
  eventId: string;
  participantId: string;
  participantName: string;
  playerId?: string;
  skillId: string;
  skillName: string;
  categoryId: string;
  categoryName: string;
  stationId?: string;
  score: number;
  maxScore: number;
  weight: number;
  comment?: string;
  mediaUrls?: string[];
  evaluatorName: string;
  evaluatorUid?: string; // signed-in scorer; guests come through functions
  createdAt: Date;
}

// ---------- Pre-built softball template (SkillShark-style starter) ----------

const skill = (name: string, weight = 1, scale: ScoreScale = 5, description?: string): Omit<EvalSkill, 'id'> =>
  ({ name, weight, scale, description });

export const SOFTBALL_TEMPLATE: { name: string; categories: Array<{ name: string; skills: Array<Omit<EvalSkill, 'id'>> }> } = {
  name: 'Softball Tryout (default)',
  categories: [
    {
      name: 'Hitting',
      skills: [
        skill('Contact / bat-to-ball', 2),
        skill('Power', 1),
        skill('Bat speed & mechanics', 1),
        skill('Bunting', 1),
        skill('Approach / pitch selection', 1),
      ],
    },
    {
      name: 'Fielding',
      skills: [
        skill('Ground balls', 2),
        skill('Fly balls', 1),
        skill('Footwork & positioning', 1),
        skill('Glove work / hands', 1),
        skill('Game awareness', 1),
      ],
    },
    {
      name: 'Throwing',
      skills: [
        skill('Arm strength', 1),
        skill('Accuracy', 2),
        skill('Mechanics / release', 1),
      ],
    },
    {
      name: 'Speed & Athleticism',
      skills: [
        skill('Home to 1st', 1, 5, 'Timed — score against age benchmarks'),
        skill('Base running instincts', 1),
        skill('Agility', 1),
      ],
    },
    {
      name: 'Pitching / Catching (if applicable)',
      skills: [
        skill('Pitching velocity & spin', 1),
        skill('Pitching control', 1),
        skill('Catching: receiving & blocking', 1),
        skill('Catching: pop time / throwdowns', 1),
      ],
    },
    {
      name: 'Intangibles',
      skills: [
        skill('Hustle & effort', 2),
        skill('Coachability / attitude', 2),
        skill('Softball IQ', 1),
      ],
    },
  ],
};

// ---------- helpers ----------

const uuid = () => crypto.randomUUID();

const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
};
const deepClean = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export const instantiateTemplate = (
  tpl: typeof SOFTBALL_TEMPLATE
): { name: string; categories: EvalCategory[] } => ({
  name: tpl.name,
  categories: tpl.categories.map((c) => ({
    id: uuid(),
    name: c.name,
    skills: c.skills.map((s) => ({ id: uuid(), ...s })),
  })),
});

/** Default stations: one per category (the SkillShark pattern). */
export const stationsFromCategories = (categories: EvalCategory[]): EvalStation[] =>
  categories.map((c) => ({ id: uuid(), name: c.name, skillIds: c.skills.map((s) => s.id) }));

// ---------- converters ----------

const convertTemplate = (id: string, d: any): EvalTemplate => ({
  id,
  name: d.name || '',
  categories: d.categories || [],
  createdBy: d.createdBy || '',
  createdAt: d.createdAt?.toDate?.() || new Date(),
});

const convertEvent = (id: string, d: any): EvalEvent => ({
  id,
  name: d.name || '',
  date: d.date?.toDate?.() || new Date(),
  type: d.type || 'tryout',
  status: d.status || 'draft',
  templateName: d.templateName || '',
  categories: d.categories || [],
  stations: d.stations || [],
  participants: d.participants || [],
  season: d.season || undefined,
  createdBy: d.createdBy || '',
  createdAt: d.createdAt?.toDate?.() || new Date(),
});

const convertScore = (id: string, d: any): EvalScore => ({
  id,
  eventId: d.eventId,
  participantId: d.participantId,
  participantName: d.participantName || '',
  playerId: d.playerId || undefined,
  skillId: d.skillId,
  skillName: d.skillName || '',
  categoryId: d.categoryId || '',
  categoryName: d.categoryName || '',
  stationId: d.stationId || undefined,
  score: d.score ?? 0,
  maxScore: d.maxScore ?? 5,
  weight: d.weight ?? 1,
  comment: d.comment || undefined,
  mediaUrls: d.mediaUrls || [],
  evaluatorName: d.evaluatorName || '',
  evaluatorUid: d.evaluatorUid || undefined,
  createdAt: d.createdAt?.toDate?.() || new Date(),
});

// ---------- APIs ----------

export const evalTemplatesApi = {
  getAll: async (): Promise<EvalTemplate[]> => {
    const snap = await getDocs(query(collection(db, 'evalTemplates'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => convertTemplate(d.id, d.data()));
  },
  create: async (data: Omit<EvalTemplate, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'evalTemplates'), {
      ...deepClean(data),
      createdAt: Timestamp.now(),
    });
    return ref.id;
  },
  update: async (id: string, data: Partial<EvalTemplate>): Promise<void> => {
    await updateDoc(doc(db, 'evalTemplates', id), cleanData({ ...deepClean(data), updatedAt: Timestamp.now() } as any));
  },
  remove: async (id: string): Promise<void> => deleteDoc(doc(db, 'evalTemplates', id)),
};

export const evalEventsApi = {
  getAll: async (): Promise<EvalEvent[]> => {
    const snap = await getDocs(query(collection(db, 'evalEvents'), orderBy('date', 'desc')));
    return snap.docs.map((d) => convertEvent(d.id, d.data()));
  },
  getById: async (id: string): Promise<EvalEvent | null> => {
    const snap = await getDoc(doc(db, 'evalEvents', id));
    return snap.exists() ? convertEvent(snap.id, snap.data()) : null;
  },
  create: async (data: Omit<EvalEvent, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'evalEvents'), {
      ...deepClean({ ...data, date: undefined }),
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now(),
    });
    return ref.id;
  },
  update: async (id: string, data: Partial<EvalEvent>): Promise<void> => {
    const patch: Record<string, unknown> = deepClean({ ...data, date: undefined });
    if (data.date) patch.date = Timestamp.fromDate(data.date);
    patch.updatedAt = Timestamp.now();
    await updateDoc(doc(db, 'evalEvents', id), cleanData(patch as any));
  },
  remove: async (id: string): Promise<void> => deleteDoc(doc(db, 'evalEvents', id)),

  /**
   * The skill-tracker event that gathers a season's tryout ratings. Reuses an
   * open/draft tryout event tagged with the season (or named for it); otherwise
   * creates one from the default softball template so tryout day has a place to
   * score. Report cards and progress accrue against this single event.
   */
  getOrCreateTryoutEvent: async (season: string, createdBy: string): Promise<EvalEvent> => {
    const all = await evalEventsApi.getAll();
    const match = all.find(
      (e) =>
        e.type === 'tryout' &&
        e.status !== 'closed' &&
        (e.season === season || (!e.season && e.name.includes(season)))
    );
    if (match) return match;

    const { name: templateName, categories } = instantiateTemplate(SOFTBALL_TEMPLATE);
    const stations = stationsFromCategories(categories);
    const id = await evalEventsApi.create({
      name: `Tryouts ${season}`,
      date: new Date(),
      type: 'tryout',
      status: 'open',
      templateName,
      categories,
      stations,
      participants: [],
      season,
      createdBy,
    });
    const created = await evalEventsApi.getById(id);
    if (!created) throw new Error('Failed to create tryout evaluation event');
    return created;
  },

  /**
   * Ensure a tryout applicant is a participant in an event (matched by
   * applicantId), appending them with the next pinnie number if needed. Returns
   * the event and the participant id to score against.
   */
  ensureApplicantParticipant: async (
    event: EvalEvent,
    applicant: { id: string; playerFirstName: string; playerLastName: string; playerId?: string; division?: string }
  ): Promise<{ event: EvalEvent; participantId: string }> => {
    const existing = event.participants.find((p) => p.applicantId === applicant.id);
    if (existing) return { event, participantId: existing.id };

    const next =
      Math.max(0, ...event.participants.map((p) => parseInt(p.number, 10) || 0)) + 1;
    const participant: EvalParticipant = {
      id: uuid(),
      name: `${applicant.playerFirstName} ${applicant.playerLastName}`.trim(),
      number: String(next),
      division: applicant.division,
      checkedIn: false,
      applicantId: applicant.id,
      playerId: applicant.playerId,
    };
    const participants = [...event.participants, participant];
    await evalEventsApi.update(event.id, { participants });
    return { event: { ...event, participants }, participantId: participant.id };
  },
};

export const evalInvitesApi = {
  getByEvent: async (eventId: string): Promise<EvalInvite[]> => {
    const snap = await getDocs(query(collection(db, 'evalInvites'), where('eventId', '==', eventId)));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any), createdAt: d.data().createdAt?.toDate?.() || new Date() }) as EvalInvite)
      .sort((a, b) => a.evaluatorName.localeCompare(b.evaluatorName));
  },
  create: async (eventId: string, evaluatorName: string): Promise<EvalInvite> => {
    const token = crypto.randomUUID();
    const ref = await addDoc(collection(db, 'evalInvites'), {
      token,
      eventId,
      evaluatorName,
      active: true,
      createdAt: Timestamp.now(),
    });
    return { id: ref.id, token, eventId, evaluatorName, active: true, createdAt: new Date() };
  },
  setActive: async (id: string, active: boolean): Promise<void> =>
    updateDoc(doc(db, 'evalInvites', id), { active }),
  remove: async (id: string): Promise<void> => deleteDoc(doc(db, 'evalInvites', id)),
};

export const evalScoresApi = {
  getByEvent: async (eventId: string): Promise<EvalScore[]> => {
    const snap = await getDocs(query(collection(db, 'evalScores'), where('eventId', '==', eventId)));
    return snap.docs.map((d) => convertScore(d.id, d.data()));
  },
  /** All of a rostered player's scores across every event — progress over time. */
  getByPlayer: async (playerId: string): Promise<EvalScore[]> => {
    const snap = await getDocs(query(collection(db, 'evalScores'), where('playerId', '==', playerId)));
    return snap.docs
      .map((d) => convertScore(d.id, d.data()))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },
  create: async (data: Omit<EvalScore, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'evalScores'), cleanData({
      ...deepClean(data),
      createdAt: Timestamp.now(),
    } as any));
    return ref.id;
  },
  remove: async (id: string): Promise<void> => deleteDoc(doc(db, 'evalScores', id)),
};

// ---------- Rankings math ----------

export interface ParticipantRanking {
  participant: EvalParticipant;
  /** 0–100 weighted overall (normalized by what was actually scored). */
  overall: number | null;
  scoreCount: number;
  evaluatorCount: number;
  byCategory: Record<string, { name: string; pct: number | null; count: number }>;
}

/**
 * Weighted overall per participant. Each score contributes
 * (score/maxScore)*weight; overall = Σcontrib / Σweight * 100. Multiple scores
 * for the same skill (several evaluators) are averaged first, so one loud
 * evaluator can't dominate a skill.
 */
export const computeRankings = (event: EvalEvent, scores: EvalScore[]): ParticipantRanking[] => {
  const byParticipant = new Map<string, EvalScore[]>();
  for (const s of scores) {
    if (!byParticipant.has(s.participantId)) byParticipant.set(s.participantId, []);
    byParticipant.get(s.participantId)!.push(s);
  }

  const rankings = event.participants.map((p) => {
    const mine = byParticipant.get(p.id) || [];
    // Average per skill across evaluators.
    const bySkill = new Map<string, EvalScore[]>();
    for (const s of mine) {
      if (!bySkill.has(s.skillId)) bySkill.set(s.skillId, []);
      bySkill.get(s.skillId)!.push(s);
    }

    let weightSum = 0;
    let contrib = 0;
    const byCategory: ParticipantRanking['byCategory'] = {};
    for (const cat of event.categories) {
      byCategory[cat.id] = { name: cat.name, pct: null, count: 0 };
    }

    const catAgg = new Map<string, { w: number; c: number; n: number }>();
    for (const [, skillScores] of bySkill) {
      const first = skillScores[0];
      const avg = skillScores.reduce((s, x) => s + x.score / x.maxScore, 0) / skillScores.length;
      const w = first.weight || 1;
      weightSum += w;
      contrib += avg * w;
      const agg = catAgg.get(first.categoryId) || { w: 0, c: 0, n: 0 };
      agg.w += w;
      agg.c += avg * w;
      agg.n += skillScores.length;
      catAgg.set(first.categoryId, agg);
    }
    for (const [catId, agg] of catAgg) {
      if (byCategory[catId]) {
        byCategory[catId] = {
          name: byCategory[catId].name,
          pct: agg.w > 0 ? Math.round((agg.c / agg.w) * 100) : null,
          count: agg.n,
        };
      }
    }

    return {
      participant: p,
      overall: weightSum > 0 ? Math.round((contrib / weightSum) * 100) : null,
      scoreCount: mine.length,
      evaluatorCount: new Set(mine.map((s) => s.evaluatorName)).size,
      byCategory,
    };
  });

  return rankings.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
};
