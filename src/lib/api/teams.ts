import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Team } from '@/types/models';

const COLLECTION = 'teams';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

// Convert Firestore timestamp to Date
const convertTeam = (id: string, data: any): Team => ({
  id,
  name: data.name,
  ageGroup: data.ageGroup,
  season: data.season,
  coachIds: data.coachIds || [],
  playerIds: data.playerIds || [],
  coachId: data.coachId,
  coachName: data.coachName,
  gcTeamId: data.gcTeamId || undefined,
  active: data.active ?? true,
  status: data.status || 'active',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const teamsApi = {
  // Get all teams
  getAll: async (): Promise<Team[]> => {
    const q = query(collection(db, COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertTeam(doc.id, doc.data()));
  },

  // Get active teams
  getActive: async (): Promise<Team[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('active', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertTeam(doc.id, doc.data()));
  },

  // Get team by ID
  getById: async (id: string): Promise<Team | null> => {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertTeam(docSnap.id, docSnap.data()) : null;
  },

  // Create team
  create: async (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...teamData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  // Update team
  update: async (id: string, teamData: Partial<Team>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData({
      ...teamData,
      updatedAt: Timestamp.now(),
    }));
  },

  // Soft-delete team (archive instead of hard delete to preserve references)
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      active: false,
      status: 'archived',
      updatedAt: Timestamp.now(),
      deletedAt: Timestamp.now(),
    });

    // Unassign all players from this team
    const playersQuery = query(collection(db, 'players'), where('teamId', '==', id));
    const playersSnap = await getDocs(playersQuery);
    for (const playerDoc of playersSnap.docs) {
      await updateDoc(playerDoc.ref, {
        teamId: null,
        teamName: null,
        updatedAt: Timestamp.now(),
      });
    }

    // Clean up user teamIds references
    const usersQuery = query(collection(db, 'users'), where('teamIds', 'array-contains', id));
    const usersSnap = await getDocs(usersQuery);
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const updatedIds = (userData.teamIds || []).filter((tid: string) => tid !== id);
      await updateDoc(userDoc.ref, { teamIds: updatedIds, updatedAt: Timestamp.now() });
    }
  },

  // Assign coach
  assignCoach: async (teamId: string, coachId: string, coachName: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, teamId);
    await updateDoc(docRef, cleanData({
      coachId,
      coachName,
      updatedAt: Timestamp.now(),
    }));
  },

  // Remove coach
  removeCoach: async (teamId: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, teamId);
    await updateDoc(docRef, cleanData({
      coachId: null,
      coachName: null,
      updatedAt: Timestamp.now(),
    }));
  },

  // Sync rosters: match players to teams by teamName and fix teamId references
  syncRosters: async (): Promise<{ updated: number; teams: number }> => {
    // Get all teams
    const teamsSnap = await getDocs(collection(db, COLLECTION));
    const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get all players
    const playersSnap = await getDocs(collection(db, 'players'));
    const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build a map of teamName -> team doc ID
    const teamNameToId: Record<string, string> = {};
    for (const t of teams) {
      if ((t as any).name) {
        teamNameToId[(t as any).name] = t.id;
      }
    }

    let updated = 0;
    const teamPlayerMap: Record<string, string[]> = {};

    for (const player of players) {
      const p = player as any;
      const teamName = p.teamName;
      if (!teamName) continue;

      const correctTeamId = teamNameToId[teamName];
      if (!correctTeamId) continue;

      // Track players per team
      if (!teamPlayerMap[correctTeamId]) teamPlayerMap[correctTeamId] = [];
      teamPlayerMap[correctTeamId].push(player.id);

      // Fix player's teamId if it doesn't match
      if (p.teamId !== correctTeamId) {
        await updateDoc(doc(db, 'players', player.id), cleanData({
          teamId: correctTeamId,
          updatedAt: Timestamp.now(),
        }));
        updated++;
      }
    }

    // Update each team's playerIds array
    let teamsUpdated = 0;
    for (const [teamId, playerIds] of Object.entries(teamPlayerMap)) {
      await updateDoc(doc(db, COLLECTION, teamId), cleanData({
        playerIds,
        updatedAt: Timestamp.now(),
      }));
      teamsUpdated++;
    }

    return { updated, teams: teamsUpdated };
  },
};
