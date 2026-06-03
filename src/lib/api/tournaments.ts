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
import { costItemsApi } from './costItems';
import type { Tournament, TournamentWorkflowStatus } from '@/types/models';

const COLLECTION = 'tournaments';

/** Strip undefined values from an object (recursively) before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)
          ? cleanData(item as Record<string, unknown>)
          : item
      );
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !(value as any).toDate) {
      result[key] = cleanData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
};

const convertTournament = (id: string, data: any): Tournament => ({
  id,
  name: data.name,
  location: data.location,
  startDate: data.startDate?.toDate() || new Date(),
  endDate: data.endDate?.toDate() || new Date(),
  teamIds: data.teamIds || [],
  contactName: data.contactName || '',
  contactPhone: data.contactPhone || '',
  contactEmail: data.contactEmail || '',
  contact: data.contact || '',
  notes: data.notes || '',
  cost: data.cost || 0,
  status: data.status || 'upcoming',
  workflowStatus: data.workflowStatus || 'wanting',
  depositAmount: data.depositAmount,
  depositPaidDate: data.depositPaidDate?.toDate(),
  balanceDueDate: data.balanceDueDate?.toDate(),
  balancePaid: data.balancePaid,
  registrationUrl: data.registrationUrl,
  websiteUrl: data.websiteUrl || '',
  scheduleUrl: data.scheduleUrl || '',
  accommodationsInfo: data.accommodationsInfo,
  insuranceSent: data.insuranceSent || false,
  insuranceSentDate: data.insuranceSentDate?.toDate(),
  statusHistory: (data.statusHistory || []).map((h: any) => ({
    ...h,
    changedAt: h.changedAt?.toDate() || new Date(),
  })),
});

export const tournamentsApi = {
  getById: async (id: string): Promise<Tournament | null> => {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    return convertTournament(docSnap.id, docSnap.data());
  },

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
      workflowStatus: data.workflowStatus || 'wanting',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (data.insuranceSentDate) {
      saveData.insuranceSentDate = Timestamp.fromDate(data.insuranceSentDate);
    }
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
    const docRef = await addDoc(collection(db, COLLECTION), cleanData(saveData));
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
    if (data.insuranceSentDate) {
      updateData.insuranceSentDate = Timestamp.fromDate(data.insuranceSentDate);
    }
    if (data.statusHistory) {
      updateData.statusHistory = data.statusHistory.map((h) => ({
        ...h,
        changedAt: h.changedAt instanceof Date ? Timestamp.fromDate(h.changedAt) : h.changedAt,
      }));
    }
    await updateDoc(docRef, cleanData(updateData));
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
    const oldStatus = tournament.workflowStatus || 'wanting';
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

    // Auto-create cost items when advancing to entered
    if (newStatus === 'entered' && tournament.cost > 0 && tournament.teamIds.length > 0) {
      await tournamentsApi.createTournamentCostItems(tournament, userId);
    }

    // If rolling back from entered, remove cost items
    if (oldStatus === 'entered' && newStatus !== 'entered') {
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
