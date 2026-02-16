import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { GCStats, GCGame } from '@/types/models';

const STATS_COLLECTION = 'gcStats';
const GAMES_COLLECTION = 'gcGames';

const convertGCStats = (id: string, data: any): GCStats => ({
  id,
  playerId: data.playerId || '',
  playerName: data.playerName || '',
  teamId: data.teamId || '',
  gcTeamId: data.gcTeamId || '',
  season: data.season || '',
  statType: data.statType,
  stats: data.stats || {},
  scrapedAt: data.scrapedAt?.toDate() || new Date(),
});

const convertGCGame = (id: string, data: any): GCGame => ({
  id,
  gcTeamId: data.gcTeamId || '',
  teamId: data.teamId || '',
  opponent: data.opponent || '',
  date: data.date?.toDate() || new Date(),
  location: data.location || '',
  scoreUs: data.scoreUs || 0,
  scoreThem: data.scoreThem || 0,
  result: data.result || 'T',
  season: data.season || '',
  scrapedAt: data.scrapedAt?.toDate() || new Date(),
});

export const gcStatsApi = {
  getAll: async (): Promise<GCStats[]> => {
    const q = query(collection(db, STATS_COLLECTION), orderBy('scrapedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCStats(doc.id, doc.data()));
  },

  getByPlayer: async (playerId: string): Promise<GCStats[]> => {
    const q = query(
      collection(db, STATS_COLLECTION),
      where('playerId', '==', playerId),
      orderBy('scrapedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCStats(doc.id, doc.data()));
  },

  getByTeam: async (teamId: string): Promise<GCStats[]> => {
    const q = query(
      collection(db, STATS_COLLECTION),
      where('teamId', '==', teamId),
      orderBy('scrapedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCStats(doc.id, doc.data()));
  },

  getBySeason: async (season: string): Promise<GCStats[]> => {
    const q = query(
      collection(db, STATS_COLLECTION),
      where('season', '==', season),
      orderBy('scrapedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCStats(doc.id, doc.data()));
  },

  getByPlayerAndType: async (playerId: string, statType: string): Promise<GCStats[]> => {
    const q = query(
      collection(db, STATS_COLLECTION),
      where('playerId', '==', playerId),
      where('statType', '==', statType),
      orderBy('scrapedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCStats(doc.id, doc.data()));
  },

  upsert: async (gcTeamId: string, playerId: string, statType: string, season: string, data: Omit<GCStats, 'id' | 'scrapedAt'>): Promise<string> => {
    // Use a deterministic ID so we update rather than duplicate
    const docId = `${gcTeamId}_${playerId}_${statType}_${season}`;
    const docRef = doc(db, STATS_COLLECTION, docId);
    await setDoc(docRef, {
      ...data,
      scrapedAt: Timestamp.now(),
    });
    return docId;
  },

  create: async (data: Omit<GCStats, 'id' | 'scrapedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, STATS_COLLECTION), {
      ...data,
      scrapedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, STATS_COLLECTION, id);
    await deleteDoc(docRef);
  },
};

export const gcGamesApi = {
  getAll: async (): Promise<GCGame[]> => {
    const q = query(collection(db, GAMES_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCGame(doc.id, doc.data()));
  },

  getByTeam: async (teamId: string): Promise<GCGame[]> => {
    const q = query(
      collection(db, GAMES_COLLECTION),
      where('teamId', '==', teamId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCGame(doc.id, doc.data()));
  },

  getByGCTeam: async (gcTeamId: string): Promise<GCGame[]> => {
    const q = query(
      collection(db, GAMES_COLLECTION),
      where('gcTeamId', '==', gcTeamId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCGame(doc.id, doc.data()));
  },

  getBySeason: async (season: string): Promise<GCGame[]> => {
    const q = query(
      collection(db, GAMES_COLLECTION),
      where('season', '==', season),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertGCGame(doc.id, doc.data()));
  },

  upsert: async (gcTeamId: string, dateStr: string, opponent: string, data: Omit<GCGame, 'id' | 'scrapedAt'>): Promise<string> => {
    // Deterministic ID to avoid duplicate games
    const sanitized = opponent.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const docId = `${gcTeamId}_${dateStr}_${sanitized}`;
    const docRef = doc(db, GAMES_COLLECTION, docId);
    await setDoc(docRef, {
      ...data,
      date: Timestamp.fromDate(data.date),
      scrapedAt: Timestamp.now(),
    });
    return docId;
  },

  create: async (data: Omit<GCGame, 'id' | 'scrapedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, GAMES_COLLECTION), {
      ...data,
      date: Timestamp.fromDate(data.date),
      scrapedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, GAMES_COLLECTION, id);
    await deleteDoc(docRef);
  },
};
