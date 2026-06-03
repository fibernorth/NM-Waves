import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { BankReconciliation, GeneralLedgerEntry } from '@/types/models';

const COLLECTION = 'bankReconciliations';
const GL_COLLECTION = 'generalLedger';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convert = (id: string, data: any): BankReconciliation => ({
  id,
  accountName: data.accountName || '',
  accountNumber: data.accountNumber || '',
  statementDate: data.statementDate?.toDate() || new Date(),
  statementEndingBalance: data.statementEndingBalance || 0,
  clearedDeposits: data.clearedDeposits || 0,
  clearedPayments: data.clearedPayments || 0,
  clearedBalance: data.clearedBalance || 0,
  outstandingDeposits: data.outstandingDeposits || 0,
  outstandingPayments: data.outstandingPayments || 0,
  adjustedBankBalance: data.adjustedBankBalance || 0,
  difference: data.difference || 0,
  status: data.status || 'in_progress',
  clearedTransactionIds: data.clearedTransactionIds || [],
  completedAt: data.completedAt?.toDate(),
  completedBy: data.completedBy,
  notes: data.notes,
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

const convertGLEntry = (id: string, data: any): GeneralLedgerEntry => ({
  id,
  date: data.date?.toDate() || new Date(),
  accountId: data.accountId,
  accountNumber: data.accountNumber,
  accountName: data.accountName,
  debit: data.debit || 0,
  credit: data.credit || 0,
  memo: data.memo || '',
  sourceType: data.sourceType,
  sourceId: data.sourceId,
  season: data.season,
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate() || new Date(),
});

// ============================================
// API
// ============================================

export const bankReconciliationApi = {
  getAll: async (): Promise<BankReconciliation[]> => {
    const q = query(collection(db, COLLECTION), orderBy('statementDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  getById: async (id: string): Promise<BankReconciliation | null> => {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convert(docSnap.id, docSnap.data()) : null;
  },

  create: async (
    data: Omit<BankReconciliation, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...data,
      statementDate: Timestamp.fromDate(data.statementDate),
      completedAt: data.completedAt ? Timestamp.fromDate(data.completedAt) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  /**
   * Query GL entries for a specific account that have NOT been reconciled.
   * The `reconciled` field is stored directly on the GL entry document.
   */
  getUnclearedTransactions: async (accountNumber: string): Promise<GeneralLedgerEntry[]> => {
    // Fetch all GL entries for this account, then filter out reconciled ones client-side
    // (Firestore doesn't index boolean-false or missing-field queries well)
    const q = query(
      collection(db, GL_COLLECTION),
      where('accountNumber', '==', accountNumber),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => convertGLEntry(d.id, d.data()))
      .filter(entry => {
        // Check the raw Firestore data for reconciled flag
        const raw = snapshot.docs.find(sd => sd.id === entry.id)?.data();
        return !raw?.reconciled;
      });
  },

  /**
   * Mark a set of GL entries as reconciled and save the reconciliation record.
   */
  saveReconciliation: async (
    reconciliation: Omit<BankReconciliation, 'id' | 'createdAt' | 'updatedAt'>,
    clearedEntryIds: string[],
  ): Promise<string> => {
    // 1. Save the reconciliation record
    const recId = await bankReconciliationApi.create(reconciliation);

    // 2. Mark each cleared GL entry as reconciled
    const promises = clearedEntryIds.map(entryId => {
      const docRef = doc(db, GL_COLLECTION, entryId);
      return updateDoc(docRef, {
        reconciled: true,
        reconciledAt: Timestamp.now(),
        bankReconciliationId: recId,
      });
    });
    await Promise.all(promises);

    return recId;
  },
};
