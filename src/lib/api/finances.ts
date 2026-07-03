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
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { GlobalCostAssumptions, PlayerFinance, Payment, IncomeCategory, Income } from '@/types/models';

const COSTS_COLLECTION = 'costs';
const FINANCES_COLLECTION = 'playerFinances';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

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
    payerName: p.payerName || '',
    payerEmail: p.payerEmail || '',
    sponsorId: p.sponsorId,
    sponsorName: p.sponsorName,
    processingFee: p.processingFee,
    reconciled: p.reconciled || false,
    reconciledAt: p.reconciledAt?.toDate(),
    reconciledBy: p.reconciledBy,
    recordedBy: p.recordedBy,
    recordedAt: p.recordedAt?.toDate() || new Date(),
  }));

  const totalOwed = computeFeeTotal(data);

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
    balanceDue: totalOwed - totalPaid - (data.scholarshipAmount || 0),
    status: data.status || ((totalOwed - totalPaid - (data.scholarshipAmount || 0)) <= 0 ? 'paid' : 'current'),
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
      where('playerId', '==', playerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => convertPlayerFinance(doc.id, doc.data()))
      .sort((a, b) => (b.season || '').localeCompare(a.season || ''));
  },

  // Get finances by team
  getByTeam: async (teamId: string): Promise<PlayerFinance[]> => {
    const q = query(
      collection(db, FINANCES_COLLECTION),
      where('teamId', '==', teamId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => convertPlayerFinance(doc.id, doc.data()))
      .sort((a, b) => (a.playerName || '').localeCompare(b.playerName || ''));
  },

  // Get finances by season
  getBySeason: async (season: string): Promise<PlayerFinance[]> => {
    const q = query(
      collection(db, FINANCES_COLLECTION),
      where('season', '==', season)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => convertPlayerFinance(doc.id, doc.data()))
      .sort((a, b) => (a.playerName || '').localeCompare(b.playerName || ''));
  },

  // Get finance by ID
  getById: async (id: string): Promise<PlayerFinance | null> => {
    const docRef = doc(db, FINANCES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertPlayerFinance(docSnap.id, docSnap.data()) : null;
  },

  // Create finance record
  create: async (financeData: Omit<PlayerFinance, 'id' | 'totalPaid' | 'totalOwed' | 'balance' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, FINANCES_COLLECTION), cleanData({
      ...financeData,
      payments: financeData.payments || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  // Update finance record
  update: async (id: string, financeData: Partial<PlayerFinance>): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, id);
    const updateData: any = { ...financeData };
    if (updateData.payments) {
      updateData.payments = updateData.payments.map((p: any) => ({
        ...p,
        date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
        recordedAt: p.recordedAt instanceof Date ? Timestamp.fromDate(p.recordedAt) : p.recordedAt,
      }));
    }
    await updateDoc(docRef, cleanData({
      ...updateData,
      updatedAt: Timestamp.now(),
    }));
  },

  // Delete finance record
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, id);
    await deleteDoc(docRef);
  },

  // Add payment (returns the payment ID)
  // Also creates an income record so the payment appears in financial reports.
  addPayment: async (financeId: string, payment: Omit<Payment, 'id' | 'recordedAt'>): Promise<string> => {
    const docRef = doc(db, FINANCES_COLLECTION, financeId);
    const docSnap = await getDoc(docRef);

    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (!docSnap.exists()) {
      throw new Error('Player finance record not found');
    }

    const data = docSnap.data();

    const newPayment: any = {
      id: paymentId,
      ...payment,
      date: Timestamp.fromDate(payment.date),
      recordedAt: Timestamp.now(),
    };

    // Also create an income record so the payment shows in Income page & financial reports
    const incomeCategory: IncomeCategory = payment.sponsorId ? 'sponsorships' : 'player_payments';
    const source = payment.sponsorName
      ? `Sponsor: ${payment.sponsorName}`
      : payment.payerName || data.playerName || 'Player Payment';

    let incomeRecordId = '';
    try {
      const incomeRef = await addDoc(collection(db, 'income'), cleanData({
        date: Timestamp.fromDate(payment.date),
        category: incomeCategory,
        amount: payment.amount,
        source,
        payerName: payment.payerName || '',
        description: `Payment for ${data.playerName || 'player'} (${data.season || ''})`,
        paymentMethod: payment.method || 'other',
        referenceNumber: payment.reference || '',
        teamId: data.teamId || '',
        playerId: data.playerId || '',
        season: data.season || '',
        notes: payment.notes || '',
        reconciled: false,
        recordedBy: payment.recordedBy || '',
        sourcePaymentId: paymentId,
        sourceFinanceId: financeId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }));
      incomeRecordId = incomeRef.id;

      // Post GL entries (best-effort)
      try {
        const { generalLedgerApi } = await import('./generalLedger');
        await generalLedgerApi.postIncome(
          {
            id: incomeRef.id,
            date: payment.date,
            category: incomeCategory,
            amount: payment.amount,
            source,
            payerName: payment.payerName || '',
            description: `Payment for ${data.playerName || 'player'} (${data.season || ''})`,
            paymentMethod: (['cash', 'check', 'credit_card', 'bank_transfer', 'venmo', 'zelle'].includes(payment.method) ? payment.method : 'other') as Income['paymentMethod'],
            season: data.season || '',
            reconciled: false,
            recordedBy: payment.recordedBy || '',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          payment.recordedBy || '',
        );
      } catch (glErr) {
        console.warn('[finances] GL posting skipped for payment:', glErr);
      }
    } catch (err) {
      console.error('[finances] Failed to create income record for payment:', err);
    }

    // Store the income record ID on the payment so we can cascade-delete later.
    // Append with arrayUnion so two admins recording payments concurrently can't
    // clobber each other via a read-modify-write of the whole payments array.
    newPayment.incomeRecordId = incomeRecordId;

    await updateDoc(docRef, {
      payments: arrayUnion(newPayment),
      updatedAt: Timestamp.now(),
    });

    return paymentId;
  },

  // Remove payment — also cascade-deletes the linked income record and GL entries
  removePayment: async (financeId: string, paymentId: string): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, financeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Player finance record not found');
    }

    const data = docSnap.data();
    const allPayments = data.payments || [];
    const deletedPayment = allPayments.find((p: any) => p.id === paymentId);

    if (!deletedPayment) {
      // Nothing to remove — the payment is already gone.
      return;
    }

    // Remove the exact stored object atomically so a concurrent add/remove can't
    // clobber the payments array via read-modify-write.
    await updateDoc(docRef, {
      payments: arrayRemove(deletedPayment),
      updatedAt: Timestamp.now(),
    });

    // Cascade-delete the linked income record (and its GL entries)
    try {
      let incomeRecordId = deletedPayment?.incomeRecordId;

      // Fallback: find the income record by sourcePaymentId (an exact 1:1 link).
      // We deliberately do NOT fall back to matching by amount/player/category —
      // that could delete the wrong income record when a player has two payments
      // of the same amount.
      if (!incomeRecordId) {
        const incomeQ = query(
          collection(db, 'income'),
          where('sourcePaymentId', '==', paymentId),
        );
        const incomeSnap = await getDocs(incomeQ);
        if (!incomeSnap.empty) {
          incomeRecordId = incomeSnap.docs[0].id;
        }
      }

      if (incomeRecordId) {
        // Delete GL entries linked to this income record
        try {
          const glQ = query(
            collection(db, 'generalLedger'),
            where('sourceId', '==', incomeRecordId),
          );
          const glSnap = await getDocs(glQ);
          for (const glDoc of glSnap.docs) {
            await deleteDoc(glDoc.ref);
          }
        } catch (glErr) {
          console.warn('[finances] GL cleanup failed for deleted payment:', glErr);
        }

        // Delete the income record
        await deleteDoc(doc(db, 'income', incomeRecordId));
      }
    } catch (err) {
      console.warn('[finances] Income/GL cleanup failed for deleted payment:', err);
    }
  },

  // Reconcile/unreconcile a payment
  reconcilePayment: async (financeId: string, paymentId: string, userId: string, reconciled: boolean): Promise<void> => {
    const docRef = doc(db, FINANCES_COLLECTION, financeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Player finance record not found');
    }

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

    await updateDoc(docRef, cleanData({
      payments,
      updatedAt: Timestamp.now(),
    }));
  },
};

/** Shared fee total calculation — single source of truth */
export const computeFeeTotal = (data: {
  registrationFee?: number;
  uniformCost?: number;
  tournamentFees?: number;
  facilityFees?: number;
  equipmentFees?: number;
  otherFees?: number;
}): number =>
  (data.registrationFee || 0) +
  (data.uniformCost || 0) +
  (data.tournamentFees || 0) +
  (data.facilityFees || 0) +
  (data.equipmentFees || 0) +
  (data.otherFees || 0);

// Utility functions for financial calculations
export const calculateFinances = (finance: Omit<PlayerFinance, 'totalPaid' | 'totalOwed' | 'balance'>) => {
  const totalOwed = computeFeeTotal(finance);

  const totalPaid = (finance.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const balance = totalPaid - totalOwed;

  return {
    totalOwed,
    totalPaid,
    balance,
  };
};
