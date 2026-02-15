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
import type { Player } from '@/types/models';

const COLLECTION = 'players';

const convertPlayer = (id: string, data: any): Player => ({
  id,
  firstName: data.firstName,
  lastName: data.lastName,
  dateOfBirth: data.dateOfBirth?.toDate(),
  teamId: data.teamId,
  teamName: data.teamName,
  jerseyNumber: data.jerseyNumber,
  gradYear: data.gradYear,
  positions: data.positions || [],
  bats: data.bats,
  throws: data.throws,
  contacts: data.contacts || [],
  parentName: data.parentName || '',
  parentEmail: data.parentEmail || '',
  parentPhone: data.parentPhone || '',
  emergencyContact: data.emergencyContact || '',
  emergencyPhone: data.emergencyPhone || '',
  medicalNotes: data.medicalNotes,
  notes: data.notes,
  playingUpFrom: data.playingUpFrom || undefined,
  active: data.active,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const playersApi = {
  // Get all players
  getAll: async (): Promise<Player[]> => {
    const q = query(collection(db, COLLECTION), orderBy('lastName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayer(doc.id, doc.data()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  },

  // Get active players
  getActive: async (): Promise<Player[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('active', '==', true),
      orderBy('lastName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayer(doc.id, doc.data()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  },

  // Get players by team
  getByTeam: async (teamId: string): Promise<Player[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('lastName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayer(doc.id, doc.data()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  },

  // Get player by ID
  getById: async (id: string): Promise<Player | null> => {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertPlayer(docSnap.id, docSnap.data()) : null;
  },

  // Create player
  create: async (playerData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...playerData,
      dateOfBirth: playerData.dateOfBirth ? Timestamp.fromDate(playerData.dateOfBirth) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // Update player
  update: async (id: string, playerData: Partial<Player>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = {
      ...playerData,
      updatedAt: Timestamp.now(),
    };

    if (playerData.dateOfBirth) {
      updateData.dateOfBirth = Timestamp.fromDate(playerData.dateOfBirth);
    }

    await updateDoc(docRef, updateData);
  },

  // Delete player
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  // Assign to team
  assignToTeam: async (playerId: string, teamId: string, teamName: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, playerId);
    await updateDoc(docRef, {
      teamId,
      teamName,
      updatedAt: Timestamp.now(),
    });
  },

  // Remove from team
  removeFromTeam: async (playerId: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, playerId);
    await updateDoc(docRef, {
      teamId: null,
      teamName: null,
      updatedAt: Timestamp.now(),
    });
  },
};
