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
import type { Equipment } from '@/types/models';

const COLLECTION = 'equipment';

const convertEquipment = (id: string, data: any): Equipment => ({
  id,
  type: data.type,
  number: data.number,
  size: data.size,
  assignedTo: data.assignedTo,
  assignedToName: data.assignedToName,
  teamId: data.teamId,
  season: data.season,
  condition: data.condition,
  cost: data.cost || 0,
  status: data.status,
  notes: data.notes,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const equipmentApi = {
  getAll: async (): Promise<Equipment[]> => {
    const q = query(collection(db, COLLECTION), orderBy('type'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEquipment(d.id, d.data()));
  },

  getById: async (id: string): Promise<Equipment | null> => {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertEquipment(docSnap.id, docSnap.data()) : null;
  },

  getBySeason: async (season: string): Promise<Equipment[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('season', '==', season),
      orderBy('type')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEquipment(d.id, d.data()));
  },

  getByTeam: async (teamId: string): Promise<Equipment[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('type')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEquipment(d.id, d.data()));
  },

  getByPlayer: async (playerId: string): Promise<Equipment[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('assignedTo', '==', playerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEquipment(d.id, d.data()));
  },

  getByNumber: async (number: number): Promise<Equipment[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('number', '==', number)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEquipment(d.id, d.data()));
  },

  getByType: async (type: string): Promise<Equipment[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('type', '==', type),
      orderBy('number')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertEquipment(d.id, d.data()));
  },

  create: async (data: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  update: async (id: string, data: Partial<Equipment>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const { id: _id, createdAt: _ca, ...updateData } = data as any;
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  assign: async (id: string, playerId: string, playerName: string, teamId?: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      assignedTo: playerId,
      assignedToName: playerName,
      teamId: teamId || null,
      status: 'assigned',
      updatedAt: Timestamp.now(),
    });
  },

  unassign: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      assignedTo: null,
      assignedToName: null,
      status: 'available',
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Validate that a jersey number is not already in use within +/- 1 age level.
   * Returns conflict info if the number is taken, null if available.
   */
  validateNumber: async (
    number: number,
    _ageGroup: string,
    season: string,
    excludeEquipmentId?: string
  ): Promise<{ conflictPlayer: string; conflictTeam?: string; conflictAgeGroup: string } | null> => {
    // Get all equipment with this number in the current season
    const q = query(
      collection(db, COLLECTION),
      where('number', '==', number),
      where('season', '==', season),
      where('status', '==', 'assigned')
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs
      .map((d) => convertEquipment(d.id, d.data()))
      .filter((e) => e.id !== excludeEquipmentId);

    for (const item of items) {
      if (item.assignedTo && item.assignedToName) {
        return {
          conflictPlayer: item.assignedToName,
          conflictTeam: item.teamId,
          conflictAgeGroup: _ageGroup,
        };
      }
    }

    return null;
  },
};
