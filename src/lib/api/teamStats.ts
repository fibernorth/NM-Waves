import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface PlayerBattingStats {
  gp: number;
  pa: number;
  ab: number;
  avg: string;
  obp: string;
  ops: string;
  slg: string;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  r: number;
  bb: number;
  so: number;
  hbp: number;
  sb: number;
  cs: number;
}

export interface PlayerPitchingStats {
  ip: string;
  gp: number;
  gs: number;
  w: number;
  l: number;
  era: string;
  whip: string;
  so: number;
  bb: number;
  h: number;
  r: number;
  er: number;
  hbp: number;
  baa: string;
  bf: number;
  np: number;
}

export interface PlayerFieldingStats {
  tc: number;
  a: number;
  po: number;
  fpct: string;
  e: number;
  dp: number;
}

export interface PlayerStats {
  number: string;
  firstName: string;
  lastName: string;
  batting: PlayerBattingStats;
  pitching: PlayerPitchingStats;
  fielding: PlayerFieldingStats;
}

export interface TeamStatsDoc {
  id: string;
  teamName: string;
  season: string;
  teamId: string;
  importedAt: Date;
  players: PlayerStats[];
  totals: {
    batting: PlayerBattingStats;
    pitching: PlayerPitchingStats;
    fielding: PlayerFieldingStats;
  } | null;
}

const COLLECTION = 'teamStats';

const convertDoc = (id: string, data: any): TeamStatsDoc => ({
  id,
  teamName: data.teamName || '',
  season: data.season || '',
  teamId: data.teamId || '',
  importedAt: data.importedAt?.toDate() || new Date(),
  players: data.players || [],
  totals: data.totals || null,
});

export const teamStatsApi = {
  getAll: async (): Promise<TeamStatsDoc[]> => {
    const q = query(collection(db, COLLECTION), orderBy('importedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertDoc(d.id, d.data()));
  },

  getById: async (id: string): Promise<TeamStatsDoc | null> => {
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return convertDoc(snapshot.id, snapshot.data());
  },

  getByTeamId: async (teamId: string): Promise<TeamStatsDoc[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('importedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertDoc(d.id, d.data()));
  },
};
