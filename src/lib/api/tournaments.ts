import {
  collection,
  doc,
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
import { costItemsApi } from './costItems';
import type { Tournament, TournamentWorkflowStatus } from '@/types/models';

const COLLECTION = 'tournaments';

const convertTournament = (id: string, data: any): Tournament => ({
  id,
  name: data.name,
  location: data.location,
  startDate: data.startDate?.toDate() || new Date(),
  endDate: data.endDate?.toDate() || new Date(),
  teamIds: data.teamIds || [],
  contact: data.contact || '',
  notes: data.notes || '',
  cost: data.cost || 0,
  status: data.status || 'upcoming',
  workflowStatus: data.workflowStatus || 'planning',
  depositAmount: data.depositAmount,
  depositPaidDate: data.depositPaidDate?.toDate(),
  balanceDueDate: data.balanceDueDate?.toDate(),
  balancePaid: data.balancePaid,
  registrationUrl: data.registrationUrl,
  accommodationsInfo: data.accommodationsInfo,
  statusHistory: (data.statusHistory || []).map((h: any) => ({
    ...h,
    changedAt: h.changedAt?.toDate() || new Date(),
  })),
});

export const tournamentsApi = {
  getAll: async (): Promise<Tournament[]> => {
    const q = query(collection(db, COLLECTION), orderBy('startDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertTournament(doc.id, doc.data()));
  },

  getUpcoming: async (): Promise<Tournament[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'upcoming'),
      orderBy('startDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertTournament(doc.id, doc.data()));
  },

  create: async (data: Omit<Tournament, 'id'>): Promise<string> => {
    const saveData: any = {
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      workflowStatus: data.workflowStatus || 'planning',
    };
    if (data.depositPaidDate) {
      saveData.depositPaidDate = Timestamp.fromDate(data.depositPaidDate);
    }
    if (data.balanceDueDate) {
      saveData.balanceDueDate = Timestamp.fromDate(data.balanceDueDate);
    }
    if (data.statusHistory) {
      saveData.statusHistory = data.statusHistory.map((h) => ({
        ...h,
        changedAt: Timestamp.fromDate(h.changedAt),
      }));
    }
    const docRef = await addDoc(collection(db, COLLECTION), saveData);
    return docRef.id;
  },

  update: async (id: string, data: Partial<Tournament>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...data };
    if (data.startDate) {
      updateData.startDate = Timestamp.fromDate(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = Timestamp.fromDate(data.endDate);
    }
    if (data.depositPaidDate) {
      updateData.depositPaidDate = Timestamp.fromDate(data.depositPaidDate);
    }
    if (data.balanceDueDate) {
      updateData.balanceDueDate = Timestamp.fromDate(data.balanceDueDate);
    }
    if (data.statusHistory) {
      updateData.statusHistory = data.statusHistory.map((h) => ({
        ...h,
        changedAt: h.changedAt instanceof Date ? Timestamp.fromDate(h.changedAt) : h.changedAt,
      }));
    }
    await updateDoc(docRef, updateData);
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    // Also delete associated cost items
    await costItemsApi.deleteByTournament(id);
    await deleteDoc(docRef);
  },

  /**
   * Advance tournament workflow status.
   * When advancing to 'signed_up', auto-creates cost items for each team.
   */
  advanceWorkflowStatus: async (
    tournament: Tournament,
    newStatus: TournamentWorkflowStatus,
    userId: string,
    notes?: string
  ): Promise<void> => {
    const oldStatus = tournament.workflowStatus || 'planning';
    const historyEntry = {
      from: oldStatus,
      to: newStatus,
      changedBy: userId,
      changedAt: new Date(),
      notes,
    };

    const existingHistory = tournament.statusHistory || [];
    await tournamentsApi.update(tournament.id, {
      workflowStatus: newStatus,
      statusHistory: [...existingHistory, historyEntry],
    });

    // Auto-create cost items when advancing to signed_up
    if (newStatus === 'signed_up' && tournament.cost > 0 && tournament.teamIds.length > 0) {
      await tournamentsApi.createTournamentCostItems(tournament, userId);
    }

    // If rolling back from signed_up, remove cost items
    if (oldStatus === 'signed_up' && newStatus !== 'signed_up') {
      await costItemsApi.deleteByTournament(tournament.id);
    }
  },

  /**
   * Create cost items for a tournament's teams.
   * One CostItem per team, with amount = tournament.cost (total cost per team).
   */
  createTournamentCostItems: async (
    tournament: Tournament,
    userId: string
  ): Promise<void> => {
    // First remove any existing cost items for this tournament
    await costItemsApi.deleteByTournament(tournament.id);

    const season = tournament.startDate.getFullYear().toString();
    const costPerTeam = tournament.teamIds.length > 0
      ? tournament.cost / tournament.teamIds.length
      : tournament.cost;

    for (const teamId of tournament.teamIds) {
      await costItemsApi.create({
        tier: 'team',
        category: 'tournament',
        label: `${tournament.name}`,
        amount: costPerTeam,
        season,
        teamId,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        financeField: 'tournamentFees',
        notes: `Auto-created from tournament signup`,
        active: true,
        createdBy: userId,
      });
    }
  },
};
