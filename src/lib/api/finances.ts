import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { GlobalCostAssumptions, PlayerFinance, Payment } from '@/types/models';

const COSTS_COLLECTION = 'costs';
const FINANCES_COLLECTION = 'playerFinances';

// Global Cost Assumptions
export const costAssumptionsApi = {
  get: async (): Promise<GlobalCostAssumptions | null> => {
    const docRef = doc(db, COSTS_COLLECTION, 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: 'global',
        registrationFee: data.registrationFee || 0,
        uniformCost: data.uniformCost || 0,
        tournamentCost: data.tournamentCost || 0,
        indoorFacilityCost: data.indoorFacilityCost || 0,
        insurance: data.insurance || 0,
        adminFee: data.adminFee || 0,
        otherCosts: data.otherCosts || [],
        tournamentFeePerEvent: data.tournamentFeePerEvent || 0,
        facilityFeePerSeason: data.facilityFeePerSeason || 0,
        equipmentFeePerSeason: data.equipmentFeePerSeason || 0,
        fundraisingTarget: data.fundraisingTarget || 0,
        season: data.season || '',
        updatedAt: data.updatedAt?.toDate() || new Date(),
        updatedBy: data.updatedBy || '',
      };
    }
    return null;
  },

  update: async (costs: Omit<GlobalCostAssumptions, 'id'>, userId: string): Promise<void> => {
    const docRef = doc(db, COSTS_COLLECTION, 'global');
    await setDoc(docRef, {
      ...costs,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  },
};

// Player Finances
const convertPlayerFinance = (id: string, data: any): PlayerFinance => {
  const payments: Payment[] = (data.payments || []).map((p: any) => ({
    id: p.id,
    amount: p.amount,
    date: p.date?.toDate() || new Date(),
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    sponsorId: p.sponsorId,
    sponsorName: p.sponsorName,
    reconciled: p.reconciled || false,
    reconciledAt: p.reconciledAt?.toDate(),
    reconciledBy: p.reconciledBy,
    recordedBy: p.recordedBy,
    recordedAt: p.recordedAt?.toDate() || new Date(),
  }));

  const totalOwed =
    data.registrationFee +
    data.uniformCost +
    data.tournamentFees +
    data.facilityFees +
    data.equipmentFees +
    data.otherFees;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalPaid - totalOwed;

  return {
    id,
    playerId: data.playerId,
    playerName: data.playerName,
    teamId: data.teamId,
    teamName: data.teamName,
    season: data.season,
    assumedCost: data.assumedCost || totalOwed,
    actualCost: data.actualCost || totalOwed,
    scholarshipAmount: data.scholarshipAmount || 0,
    registrationFee: data.registrationFee || 0,
    uniformCost: data.uniformCost || 0,
    tournamentFees: data.tournamentFees || 0,
    facilityFees: data.facilityFees || 0,
    equipmentFees: data.equipmentFees || 0,
    otherFees: data.otherFees || 0,
    totalPaid,
    payments,
    totalOwed,
    balance,
    balanceDue: data.balanceDue ?? (totalOwed - totalPaid - (data.scholarshipAmount || 0)),
    status: data.status || (totalPaid >= totalOwed ? 'paid' : 'current'),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
};

export const playerFinancesApi = {
  // Get all finances
  getAll: async (): Promise<PlayerFinance[]> => {
    const q = query(collection(db, FINANCES_COLLECTION), orderBy('playerName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayerFinance(doc.id, doc.data()));
  },

  // Get finances by player
  getByPlayer: async (playerId: string): Promise<PlayerFinance[]> => {
    const q = query(
      collection(db, FINANCES_COLLECTION),
      where('playerId', '==', playerId),
      orderBy('season', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayerFinance(doc.id, doc.data()));
  },

  // Get finances by team
  getByTeam: async (teamId: string): Promise<PlayerFinance[]> => {
    const q = query(
      collection(db, FINANCES_COLLECTION),
      where('teamId', '==', teamId),
      orderBy('playerName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayerFinance(doc.id, doc.data()));
  },

  // Get finances by season
  getBySeason: async (season: string): Promise<PlayerFinance[]> => {
    const q = query(
      collection(db, FINANCES_COLLECTION),
      where('season', '==', season),
      orderBy('playerName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayerFinance(doc.id, doc.data()));
  },

  // Get finance by ID
  getById: async (id: string): Promise<PlayerFinance | null> => {
    const docRef = doc(db, FINANCES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertPlayerFinance(docSnap.id, docSnap.data()) : null;
  },

  // Create finance record
  create: async (financeData: Omit<PlayerFinance, 'id' | 'totalPaid' | 'totalOwed' | 'balance' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, FINANCES_COLLECTION), {
      ...financeData,
      payments: financeData.payments || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // Update finance record
  update: async (id: string, financeData: Partial<PlayerFinance>): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, id);
    await updateDoc(docRef, {
      ...financeData,
      updatedAt: Timestamp.now(),
    });
  },

  // Delete finance record
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, id);
    await deleteDoc(docRef);
  },

  // Add payment (returns the payment ID)
  addPayment: async (financeId: string, payment: Omit<Payment, 'id' | 'recordedAt'>): Promise<string> => {
    const docRef = doc(db, FINANCES_COLLECTION, financeId);
    const docSnap = await getDoc(docRef);

    const paymentId = `payment_${Date.now()}`;

    if (docSnap.exists()) {
      const data = docSnap.data();
      const payments = data.payments || [];

      const newPayment: any = {
        id: paymentId,
        ...payment,
        date: Timestamp.fromDate(payment.date),
        recordedAt: Timestamp.now(),
      };

      payments.push(newPayment);

      await updateDoc(docRef, {
        payments,
        updatedAt: Timestamp.now(),
      });
    }

    return paymentId;
  },

  // Remove payment
  removePayment: async (financeId: string, paymentId: string): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, financeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const payments = (data.payments || []).filter((p: any) => p.id !== paymentId);

      await updateDoc(docRef, {
        payments,
        updatedAt: Timestamp.now(),
      });
    }
  },

  // Reconcile/unreconcile a payment
  reconcilePayment: async (financeId: string, paymentId: string, userId: string, reconciled: boolean): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, financeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const payments = (data.payments || []).map((p: any) => {
        if (p.id === paymentId) {
          return {
            ...p,
            reconciled,
            reconciledAt: reconciled ? Timestamp.now() : null,
            reconciledBy: reconciled ? userId : null,
          };
        }
        return p;
      });

      await updateDoc(docRef, {
        payments,
        updatedAt: Timestamp.now(),
      });
    }
  },
};

// Utility functions for financial calculations
export const calculateFinances = (finance: Omit<PlayerFinance, 'totalPaid' | 'totalOwed' | 'balance'>) => {
  const totalOwed =
    finance.registrationFee +
    finance.uniformCost +
    finance.tournamentFees +
    finance.facilityFees +
    finance.equipmentFees +
    finance.otherFees;

  const totalPaid = finance.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalPaid - totalOwed;

  return {
    totalOwed,
    totalPaid,
    balance,
  };
};
