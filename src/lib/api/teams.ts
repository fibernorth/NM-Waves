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
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Team } from '@/types/models';

const COLLECTION = 'teams';

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
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...teamData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // Update team
  update: async (id: string, teamData: Partial<Team>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      ...teamData,
      updatedAt: Timestamp.now(),
    });
  },

  // Delete team
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  // Assign coach
  assignCoach: async (teamId: string, coachId: string, coachName: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, teamId);
    await updateDoc(docRef, {
      coachId,
      coachName,
      updatedAt: Timestamp.now(),
    });
  },

  // Remove coach
  removeCoach: async (teamId: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, teamId);
    await updateDoc(docRef, {
      coachId: null,
      coachName: null,
      updatedAt: Timestamp.now(),
    });
  },
};
