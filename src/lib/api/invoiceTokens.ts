import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import type { InvoiceToken } from '@/types/models';
const COLLECTION = 'invoiceTokens';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertToken = (id: string, data: any): InvoiceToken => ({
  id,
  financeId: data.financeId,
  playerId: data.playerId,
  playerName: data.playerName || '',
  teamName: data.teamName || '',
  season: data.season || '',
  amountDue: data.amountDue || 0,
  chargeType: data.chargeType || 'full_balance',
  chargeLabel: data.chargeLabel || 'Full Balance',
  chargeAmount: data.chargeAmount ?? 0,
  registrationFee: data.registrationFee ?? 0,
  uniformCost: data.uniformCost ?? 0,
  tournamentFees: data.tournamentFees ?? 0,
  facilityFees: data.facilityFees ?? 0,
  equipmentFees: data.equipmentFees ?? 0,
  otherFees: data.otherFees ?? 0,
  scholarshipAmount: data.scholarshipAmount ?? 0,
  totalPaid: data.totalPaid ?? 0,
  token: data.token,
  invoiceNumber: data.invoiceNumber,
  dueDate: data.dueDate?.toDate(),
  paymentTerms: data.paymentTerms,
  expiresAt: data.expiresAt?.toDate() || new Date(),
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  used: data.used || false,
  usedAt: data.usedAt?.toDate(),
  usedBy: data.usedBy,
  paidByUserId: data.paidByUserId,
});

interface GenerateResult {
  token: string;
  id: string;
  invoiceNumber: string;
  amountDue: number;
  chargeType: string;
  chargeLabel: string;
  dueDate: string;
  paymentTerms: string;
  expiresAt: string;
}

interface GenerateParams {
  financeId: string;
  playerId: string;
  chargeType?: string;
  dueDate?: string;
  paymentTerms?: string;
}

interface BatchGenerateParams {
  season?: string;
  teamId?: string;
  expiryDays?: number;
  dueDate?: string;
  paymentTerms?: string;
}

interface BatchGenerateResult {
  created: number;
  skipped: number;
  errors: string[];
  season: string;
}

export const invoiceTokensApi = {
  /**
   * Generate a new invoice token via Cloud Function (admin only).
   * Pass chargeType to create a per-charge invoice, or omit for full balance.
   */
  generate: async (
    financeId: string,
    playerId: string,
    chargeType?: string,
    dueDate?: string,
    paymentTerms?: string
  ): Promise<GenerateResult> => {
    const callable = httpsCallable<GenerateParams, GenerateResult>(
      functions,
      'generateInvoiceToken'
    );

    const params: GenerateParams = { financeId, playerId };
    if (chargeType) params.chargeType = chargeType;
    if (dueDate) params.dueDate = dueDate;
    if (paymentTerms) params.paymentTerms = paymentTerms;

    try {
      const result = await callable(params);
      return result.data;
    } catch (err: any) {
      // Extract meaningful error from Firebase callable errors
      const message = err?.details || err?.message || 'Unknown error generating invoice';
      throw new Error(message);
    }
  },

  /**
   * Get an invoice token by its UUID token string.
   */
  getByToken: async (token: string): Promise<InvoiceToken | null> => {
    const q = query(
      collection(db, COLLECTION),
      where('token', '==', token)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return convertToken(docSnap.id, docSnap.data());
  },

  /**
   * Get all tokens for a given finance record.
   */
  getByFinance: async (financeId: string): Promise<InvoiceToken[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('financeId', '==', financeId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertToken(d.id, d.data()));
  },

  /**
   * Get all tokens for a given player (across all seasons).
   */
  getByPlayer: async (playerId: string): Promise<InvoiceToken[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('playerId', '==', playerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertToken(d.id, d.data()));
  },

  /**
   * Mark a token as used.
   */
  markUsed: async (tokenId: string, usedBy: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, tokenId);
    await updateDoc(docRef, cleanData({
      used: true,
      usedAt: Timestamp.now(),
      usedBy,
    }));
  },

  /**
   * Batch-generate invoices for all players with outstanding balances.
   * Creates per-charge invoices, skipping charges that already have active invoices.
   */
  batchGenerate: async (params?: BatchGenerateParams): Promise<BatchGenerateResult> => {
    const callable = httpsCallable<BatchGenerateParams, BatchGenerateResult>(
      functions,
      'batchGenerateInvoices'
    );
    const result = await callable(params || {});
    return result.data;
  },

  /**
   * Get all invoice tokens (optionally filtered by season).
   */
  getAll: async (season?: string): Promise<InvoiceToken[]> => {
    let q;
    if (season) {
      q = query(collection(db, COLLECTION), where('season', '==', season));
    } else {
      q = query(collection(db, COLLECTION));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertToken(d.id, d.data()));
  },
};
