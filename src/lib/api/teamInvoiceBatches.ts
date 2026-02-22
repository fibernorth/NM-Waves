import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { playerFinancesApi } from './finances';
import type { TeamInvoiceBatch } from '@/types/models';

const COLLECTION = 'teamInvoiceBatches';

const convertBatch = (id: string, data: any): TeamInvoiceBatch => ({
  id,
  teamId: data.teamId,
  teamName: data.teamName,
  season: data.season,
  amountPerPlayer: data.amountPerPlayer || 0,
  totalAmount: data.totalAmount || 0,
  playerCount: data.playerCount || 0,
  playerFinanceIds: data.playerFinanceIds || [],
  description: data.description || '',
  batchDate: data.batchDate?.toDate() || new Date(),
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate() || new Date(),
});

export const teamInvoiceBatchesApi = {
  getAll: async (): Promise<TeamInvoiceBatch[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertBatch(d.id, d.data()));
  },

  getByTeam: async (teamId: string): Promise<TeamInvoiceBatch[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertBatch(d.id, d.data()));
  },

  getBySeason: async (season: string): Promise<TeamInvoiceBatch[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('season', '==', season),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertBatch(d.id, d.data()));
  },

  /**
   * Invoice a team: record a payment on each player's PlayerFinance
   * and create an audit batch record.
   */
  invoiceTeam: async (params: {
    teamId: string;
    teamName: string;
    season: string;
    amountPerPlayer: number;
    description: string;
    createdBy: string;
  }): Promise<string> => {
    const { teamId, teamName, season, amountPerPlayer, description, createdBy } = params;

    // Get all finances for this team/season
    const finances = await playerFinancesApi.getByTeam(teamId);
    const seasonFinances = finances.filter((f) => f.season === season);

    if (seasonFinances.length === 0) {
      throw new Error('No player finance records found for this team and season');
    }

    const playerFinanceIds: string[] = [];

    // Record a payment on each player's finance record
    for (const finance of seasonFinances) {
      await playerFinancesApi.addPayment(finance.id, {
        amount: amountPerPlayer,
        date: new Date(),
        method: 'other',
        notes: `Team invoice: ${description}`,
        payerName: teamName,
        recordedBy: createdBy,
      });
      playerFinanceIds.push(finance.id);
    }

    // Create the batch record for audit
    const docRef = await addDoc(collection(db, COLLECTION), {
      teamId,
      teamName,
      season,
      amountPerPlayer,
      totalAmount: amountPerPlayer * seasonFinances.length,
      playerCount: seasonFinances.length,
      playerFinanceIds,
      description,
      batchDate: Timestamp.now(),
      createdBy,
      createdAt: Timestamp.now(),
    });

    return docRef.id;
  },
};
