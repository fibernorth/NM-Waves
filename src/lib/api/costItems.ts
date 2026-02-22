import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { CostItem, CostItemTier } from '@/types/models';

const COLLECTION = 'costItems';

const convertCostItem = (id: string, data: any): CostItem => ({
  id,
  tier: data.tier,
  category: data.category,
  label: data.label,
  amount: data.amount || 0,
  season: data.season || '',
  teamId: data.teamId,
  teamName: data.teamName,
  playerId: data.playerId,
  playerName: data.playerName,
  tournamentId: data.tournamentId,
  tournamentName: data.tournamentName,
  financeField: data.financeField,
  notes: data.notes,
  active: data.active ?? true,
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const costItemsApi = {
  getAll: async (): Promise<CostItem[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertCostItem(d.id, d.data()));
  },

  getByTier: async (tier: CostItemTier): Promise<CostItem[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('tier', '==', tier),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertCostItem(d.id, d.data()));
  },

  getBySeason: async (season: string): Promise<CostItem[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('season', '==', season),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertCostItem(d.id, d.data()));
  },

  getByTeam: async (teamId: string): Promise<CostItem[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertCostItem(d.id, d.data()));
  },

  getByPlayer: async (playerId: string): Promise<CostItem[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('playerId', '==', playerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertCostItem(d.id, d.data()));
  },

  getByTournament: async (tournamentId: string): Promise<CostItem[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('tournamentId', '==', tournamentId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertCostItem(d.id, d.data()));
  },

  getById: async (id: string): Promise<CostItem | null> => {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertCostItem(docSnap.id, docSnap.data()) : null;
  },

  create: async (data: Omit<CostItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  update: async (id: string, data: Partial<CostItem>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.createdAt;
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  deleteByTournament: async (tournamentId: string): Promise<void> => {
    const items = await costItemsApi.getByTournament(tournamentId);
    await Promise.all(items.map((item) => costItemsApi.delete(item.id)));
  },
};
