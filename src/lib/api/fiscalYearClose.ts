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
import { generalLedgerApi } from './generalLedger';
import { chartOfAccountsApi } from './chartOfAccounts';
import type { FiscalYearClose, ChartOfAccount } from '@/types/models';

const COLLECTION = 'fiscalYearCloses';
const GL_COLLECTION = 'generalLedger';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convert = (id: string, data: any): FiscalYearClose => ({
  id,
  fiscalYear: data.fiscalYear,
  startDate: data.startDate?.toDate() || new Date(),
  endDate: data.endDate?.toDate() || new Date(),
  closedAt: data.closedAt?.toDate() || new Date(),
  closedBy: data.closedBy || '',
  closingEntryIds: data.closingEntryIds || [],
  openingBalances: data.openingBalances || {},
  totalRevenue: data.totalRevenue || 0,
  totalExpenses: data.totalExpenses || 0,
  netIncome: data.netIncome || 0,
  notes: data.notes,
});

export const fiscalYearCloseApi = {
  /**
   * Check if a fiscal year has already been closed.
   */
  checkIfClosed: async (fiscalYear: string): Promise<FiscalYearClose | null> => {
    const q = query(
      collection(db, COLLECTION),
      where('fiscalYear', '==', fiscalYear)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return convert(doc.id, doc.data());
  },

  /**
   * Get all closed fiscal years.
   */
  getClosedYears: async (): Promise<FiscalYearClose[]> => {
    const q = query(collection(db, COLLECTION), orderBy('closedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  /**
   * Close a fiscal year. This is a permanent operation.
   *
   * 1. Verify year not already closed
   * 2. Calculate net income (revenue - expenses) for the year from GL
   * 3. Create closing journal entries:
   *    - Debit each revenue account for its total -> zero it out
   *    - Credit each expense account for its total -> zero it out
   *    - Credit/Debit "Retained Earnings" (3900) for net income
   * 4. Record the close in fiscalYearCloses collection
   */
  closeFiscalYear: async (
    fiscalYear: string,
    closedBy: string,
    notes?: string
  ): Promise<FiscalYearClose> => {
    // 1. Check if already closed
    const existing = await fiscalYearCloseApi.checkIfClosed(fiscalYear);
    if (existing) {
      throw new Error(`Fiscal year ${fiscalYear} has already been closed.`);
    }

    // 2. Get all GL entries for this fiscal year and calculate per-account totals
    const entries = await generalLedgerApi.getAll(fiscalYear);
    const allAccounts = await chartOfAccountsApi.getActive();
    const accountMap = new Map<string, ChartOfAccount>();
    for (const a of allAccounts) accountMap.set(a.accountNumber, a);

    // Aggregate by account: net balance = debit - credit
    const accountBalances = new Map<string, number>();
    for (const entry of entries) {
      const curr = accountBalances.get(entry.accountNumber) || 0;
      accountBalances.set(entry.accountNumber, curr + entry.debit - entry.credit);
    }

    // Separate revenue and expense accounts
    let totalRevenue = 0;
    let totalExpenses = 0;
    const revenueAccounts: Array<{ accountNumber: string; balance: number }> = [];
    const expenseAccounts: Array<{ accountNumber: string; balance: number }> = [];

    for (const [acctNum, netBalance] of accountBalances) {
      const acct = accountMap.get(acctNum);
      if (!acct) continue;

      if (acct.type === 'revenue') {
        // Revenue has credit normal balance; credit balance = negative netBalance
        const creditBalance = -netBalance;
        if (Math.abs(creditBalance) > 0.005) {
          totalRevenue += creditBalance;
          revenueAccounts.push({ accountNumber: acctNum, balance: creditBalance });
        }
      } else if (acct.type === 'expense') {
        // Expense has debit normal balance; debit balance = positive netBalance
        const debitBalance = netBalance;
        if (Math.abs(debitBalance) > 0.005) {
          totalExpenses += debitBalance;
          expenseAccounts.push({ accountNumber: acctNum, balance: debitBalance });
        }
      }
    }

    totalRevenue = Math.round(totalRevenue * 100) / 100;
    totalExpenses = Math.round(totalExpenses * 100) / 100;
    const netIncome = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    // 3. Create closing journal entries
    // We will create a placeholder doc ID first, then use it as sourceId
    const closingDocRef = await addDoc(collection(db, COLLECTION), cleanData({
      fiscalYear,
      startDate: Timestamp.fromDate(getFiscalYearStart(fiscalYear)),
      endDate: Timestamp.fromDate(getFiscalYearEnd(fiscalYear)),
      closedAt: Timestamp.now(),
      closedBy,
      closingEntryIds: [], // Will be updated after creating GL entries
      openingBalances: Object.fromEntries(accountBalances),
      totalRevenue,
      totalExpenses,
      netIncome,
      notes: notes || '',
    }));

    const sourceId = closingDocRef.id;
    const closingEntryIds: string[] = [];
    const colRef = collection(db, GL_COLLECTION);
    const now = Timestamp.now();
    const closingDate = getFiscalYearEnd(fiscalYear);

    const baseFields = {
      date: Timestamp.fromDate(closingDate),
      memo: `Year-end closing entry - ${fiscalYear}`,
      sourceType: 'closing',
      sourceId,
      season: fiscalYear,
      createdBy: closedBy,
      createdAt: now,
    };

    // Close each revenue account: debit revenue to zero it out
    for (const rev of revenueAccounts) {
      const acct = accountMap.get(rev.accountNumber);
      if (!acct) continue;
      const amount = Math.round(rev.balance * 100) / 100;
      const docRef = await addDoc(colRef, cleanData({
        ...baseFields,
        accountId: acct.id,
        accountNumber: acct.accountNumber,
        accountName: acct.name,
        debit: Math.abs(amount),
        credit: 0,
      }));
      closingEntryIds.push(docRef.id);
    }

    // Close each expense account: credit expense to zero it out
    for (const exp of expenseAccounts) {
      const acct = accountMap.get(exp.accountNumber);
      if (!acct) continue;
      const amount = Math.round(exp.balance * 100) / 100;
      const docRef = await addDoc(colRef, cleanData({
        ...baseFields,
        accountId: acct.id,
        accountNumber: acct.accountNumber,
        accountName: acct.name,
        debit: 0,
        credit: Math.abs(amount),
      }));
      closingEntryIds.push(docRef.id);
    }

    // Post net income to Retained Earnings (3900)
    const retainedEarningsAcct = accountMap.get('3900');
    if (retainedEarningsAcct && Math.abs(netIncome) > 0.005) {
      // Net income positive = credit Retained Earnings
      // Net loss (negative) = debit Retained Earnings
      const docRef = await addDoc(colRef, cleanData({
        ...baseFields,
        accountId: retainedEarningsAcct.id,
        accountNumber: retainedEarningsAcct.accountNumber,
        accountName: retainedEarningsAcct.name,
        debit: netIncome < 0 ? Math.abs(netIncome) : 0,
        credit: netIncome > 0 ? netIncome : 0,
      }));
      closingEntryIds.push(docRef.id);
    }

    // 4. Update the close record with the closing entry IDs
    const { updateDoc, doc: docRef } = await import('firebase/firestore');
    await updateDoc(docRef(db, COLLECTION, sourceId), {
      closingEntryIds,
    });

    return {
      id: sourceId,
      fiscalYear,
      startDate: getFiscalYearStart(fiscalYear),
      endDate: getFiscalYearEnd(fiscalYear),
      closedAt: new Date(),
      closedBy,
      closingEntryIds,
      openingBalances: Object.fromEntries(accountBalances),
      totalRevenue,
      totalExpenses,
      netIncome,
      notes,
    };
  },
};

// ============================================
// Helper functions
// ============================================

/**
 * Parse fiscal year string (e.g. "2025-2026") to start date.
 * If plain year like "2026", uses Jan 1 of that year.
 */
function getFiscalYearStart(fiscalYear: string): Date {
  if (fiscalYear.includes('-')) {
    const startYear = parseInt(fiscalYear.split('-')[0], 10);
    return new Date(startYear, 0, 1); // Jan 1 of start year
  }
  return new Date(parseInt(fiscalYear, 10), 0, 1);
}

/**
 * Parse fiscal year string (e.g. "2025-2026") to end date.
 * If plain year like "2026", uses Dec 31 of that year.
 */
function getFiscalYearEnd(fiscalYear: string): Date {
  if (fiscalYear.includes('-')) {
    const endYear = parseInt(fiscalYear.split('-')[1], 10);
    return new Date(endYear, 11, 31); // Dec 31 of end year
  }
  return new Date(parseInt(fiscalYear, 10), 11, 31);
}
