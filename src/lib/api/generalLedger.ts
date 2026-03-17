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
import type {
  GeneralLedgerEntry,
  GLSourceType,
  ChartOfAccount,
  Income,
  Expense,
} from '@/types/models';
import {
  chartOfAccountsApi,
  INCOME_CATEGORY_TO_ACCOUNT,
  EXPENSE_CATEGORY_TO_ACCOUNT,
} from './chartOfAccounts';
import { matchesSeason } from './accounting';

const COLLECTION = 'generalLedger';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convert = (id: string, data: any): GeneralLedgerEntry => ({
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
// Helpers
// ============================================

/** Build account lookup map: accountNumber -> ChartOfAccount */
async function getAccountMap(): Promise<Map<string, ChartOfAccount>> {
  const accounts = await chartOfAccountsApi.getAll();
  const map = new Map<string, ChartOfAccount>();
  for (const a of accounts) {
    map.set(a.accountNumber, a);
  }
  return map;
}

/** Create a pair of GL entries (debit + credit) for a double-entry transaction */
async function postDoubleEntry(params: {
  date: Date;
  debitAccountNumber: string;
  creditAccountNumber: string;
  amount: number;
  memo: string;
  sourceType: GLSourceType;
  sourceId?: string;
  season: string;
  createdBy: string;
  accountMap: Map<string, ChartOfAccount>;
}): Promise<void> {
  const { date, debitAccountNumber, creditAccountNumber, amount, memo, sourceType, sourceId, season, createdBy, accountMap } = params;

  if (amount <= 0) return;

  const debitAccount = accountMap.get(debitAccountNumber);
  const creditAccount = accountMap.get(creditAccountNumber);

  if (!debitAccount || !creditAccount) {
    console.warn(`GL posting skipped: missing account(s) - debit: ${debitAccountNumber}, credit: ${creditAccountNumber}`);
    return;
  }

  const colRef = collection(db, COLLECTION);

  const baseFields = {
    date: Timestamp.fromDate(date),
    memo,
    sourceType,
    sourceId: sourceId || '',
    season,
    createdBy,
    createdAt: Timestamp.now(),
  };

  // Debit entry
  const debitRef = addDoc(colRef, cleanData({
    ...baseFields,
    accountId: debitAccount.id,
    accountNumber: debitAccount.accountNumber,
    accountName: debitAccount.name,
    debit: amount,
    credit: 0,
  }));

  // Credit entry
  const creditRef = addDoc(colRef, cleanData({
    ...baseFields,
    accountId: creditAccount.id,
    accountNumber: creditAccount.accountNumber,
    accountName: creditAccount.name,
    debit: 0,
    credit: amount,
  }));

  await Promise.all([debitRef, creditRef]);
}

// ============================================
// API
// ============================================

export const generalLedgerApi = {
  /**
   * Get all GL entries, optionally filtered by season.
   */
  getAll: async (season?: string): Promise<GeneralLedgerEntry[]> => {
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(d => convert(d.id, d.data()));
    if (season) {
      return entries.filter(e => matchesSeason(e.season, season));
    }
    return entries;
  },

  /**
   * Get GL entries for a specific account.
   */
  getByAccount: async (accountNumber: string, season?: string): Promise<GeneralLedgerEntry[]> => {
    let q;
    if (season) {
      q = query(
        collection(db, COLLECTION),
        where('accountNumber', '==', accountNumber),
        where('season', '==', season),
        orderBy('date', 'desc')
      );
    } else {
      q = query(
        collection(db, COLLECTION),
        where('accountNumber', '==', accountNumber),
        orderBy('date', 'desc')
      );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  /**
   * Get GL entries by source document (e.g., all entries for a specific expense).
   */
  getBySource: async (sourceType: GLSourceType, sourceId: string): Promise<GeneralLedgerEntry[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('sourceType', '==', sourceType),
      where('sourceId', '==', sourceId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  /**
   * Post GL entries for an income record.
   * Debit: Cash (1000)
   * Credit: Revenue account (mapped from income category)
   */
  postIncome: async (income: Income, createdBy: string): Promise<void> => {
    const accountMap = await getAccountMap();
    const revenueAccount = INCOME_CATEGORY_TO_ACCOUNT[income.category] || '4900';

    await postDoubleEntry({
      date: income.date,
      debitAccountNumber: '1000', // Cash - Checking
      creditAccountNumber: revenueAccount,
      amount: income.amount,
      memo: `${income.source}: ${income.description}`,
      sourceType: 'income',
      sourceId: income.id,
      season: income.season,
      createdBy,
      accountMap,
    });
  },

  /**
   * Post GL entries for an expense record.
   * Debit: Expense account (mapped from expense category)
   * Credit: Cash (1000) if paid, Accounts Payable (2000) if unpaid
   */
  postExpense: async (expense: Expense, createdBy: string): Promise<void> => {
    const accountMap = await getAccountMap();
    const expenseAccount = EXPENSE_CATEGORY_TO_ACCOUNT[expense.category] || '5900';
    const creditAccount = expense.isPaid ? '1000' : '2000';

    await postDoubleEntry({
      date: expense.date,
      debitAccountNumber: expenseAccount,
      creditAccountNumber: creditAccount,
      amount: expense.amount,
      memo: `${expense.vendor}: ${expense.description}`,
      sourceType: 'expense',
      sourceId: expense.id,
      season: expense.season,
      createdBy,
      accountMap,
    });
  },

  /**
   * Post GL entries for a player payment.
   * Debit: Cash (1000)
   * Credit: Accounts Receivable - Player Balances (1100)
   */
  postPayment: async (params: {
    date: Date;
    amount: number;
    playerName: string;
    paymentId: string;
    season: string;
    createdBy: string;
  }): Promise<void> => {
    const accountMap = await getAccountMap();

    await postDoubleEntry({
      date: params.date,
      debitAccountNumber: '1000',
      creditAccountNumber: '1100',
      amount: params.amount,
      memo: `Payment from ${params.playerName}`,
      sourceType: 'payment',
      sourceId: params.paymentId,
      season: params.season,
      createdBy: params.createdBy,
      accountMap,
    });
  },

  /**
   * Post a manual journal entry (debit + credit pair).
   */
  postJournalEntry: async (params: {
    date: Date;
    debitAccountNumber: string;
    creditAccountNumber: string;
    amount: number;
    memo: string;
    season: string;
    createdBy: string;
  }): Promise<void> => {
    const accountMap = await getAccountMap();

    await postDoubleEntry({
      ...params,
      sourceType: 'journal',
      accountMap,
    });
  },

  /**
   * Compute trial balance: sum debits and credits per account.
   * Returns accounts with their totals; debits should equal credits.
   */
  computeTrialBalance: async (season?: string): Promise<{
    accounts: Array<{
      accountNumber: string;
      accountName: string;
      accountType: string;
      totalDebit: number;
      totalCredit: number;
      balance: number;
    }>;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> => {
    const entries = await generalLedgerApi.getAll(season);

    // Aggregate by account
    const accountTotals = new Map<string, {
      accountNumber: string;
      accountName: string;
      accountType: string;
      totalDebit: number;
      totalCredit: number;
    }>();

    // Ensure all accounts show even if zero
    const allAccounts = await chartOfAccountsApi.getActive();
    for (const a of allAccounts) {
      accountTotals.set(a.accountNumber, {
        accountNumber: a.accountNumber,
        accountName: a.name,
        accountType: a.type,
        totalDebit: 0,
        totalCredit: 0,
      });
    }

    for (const entry of entries) {
      const existing = accountTotals.get(entry.accountNumber);
      if (existing) {
        existing.totalDebit += entry.debit;
        existing.totalCredit += entry.credit;
      } else {
        accountTotals.set(entry.accountNumber, {
          accountNumber: entry.accountNumber,
          accountName: entry.accountName,
          accountType: '',
          totalDebit: entry.debit,
          totalCredit: entry.credit,
        });
      }
    }

    const accounts = Array.from(accountTotals.values())
      .map(a => ({
        ...a,
        balance: a.totalDebit - a.totalCredit,
      }))
      .filter(a => a.totalDebit !== 0 || a.totalCredit !== 0)
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const totalDebits = accounts.reduce((s, a) => s + a.totalDebit, 0);
    const totalCredits = accounts.reduce((s, a) => s + a.totalCredit, 0);

    return {
      accounts,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  },

  /**
   * Compute balance sheet data: assets, liabilities, net assets.
   * Assets = Debit balances of asset accounts
   * Liabilities = Credit balances of liability accounts
   * Net Assets = Credit balances of equity + (revenue - expenses)
   */
  computeBalanceSheet: async (season?: string): Promise<{
    assets: Array<{ accountNumber: string; name: string; balance: number }>;
    liabilities: Array<{ accountNumber: string; name: string; balance: number }>;
    netAssets: Array<{ accountNumber: string; name: string; balance: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalNetAssets: number;
    totalRevenue: number;
    totalExpenses: number;
    isBalanced: boolean;
  }> => {
    const entries = await generalLedgerApi.getAll(season);
    const allAccounts = await chartOfAccountsApi.getActive();

    // Build account lookup
    const accountMap = new Map<string, ChartOfAccount>();
    for (const a of allAccounts) accountMap.set(a.accountNumber, a);

    // Sum up net balance per account (debit - credit)
    const balances = new Map<string, number>();
    for (const entry of entries) {
      const curr = balances.get(entry.accountNumber) || 0;
      balances.set(entry.accountNumber, curr + entry.debit - entry.credit);
    }

    const assets: Array<{ accountNumber: string; name: string; balance: number }> = [];
    const liabilities: Array<{ accountNumber: string; name: string; balance: number }> = [];
    const netAssetsAccounts: Array<{ accountNumber: string; name: string; balance: number }> = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const [acctNum, netBalance] of balances) {
      const acct = accountMap.get(acctNum);
      if (!acct || netBalance === 0) continue;

      switch (acct.type) {
        case 'asset':
          // Assets have debit normal balance; positive net = debit balance
          assets.push({ accountNumber: acctNum, name: acct.name, balance: netBalance });
          break;
        case 'liability':
          // Liabilities have credit normal balance; negate to show positive
          liabilities.push({ accountNumber: acctNum, name: acct.name, balance: -netBalance });
          break;
        case 'equity':
          netAssetsAccounts.push({ accountNumber: acctNum, name: acct.name, balance: -netBalance });
          break;
        case 'revenue':
          // Revenue has credit normal balance
          totalRevenue += -netBalance;
          break;
        case 'expense':
          // Expenses have debit normal balance
          totalExpenses += netBalance;
          break;
      }
    }

    // Sort by account number
    assets.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    liabilities.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    netAssetsAccounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    const totalAssets = Math.round(assets.reduce((s, a) => s + a.balance, 0) * 100) / 100;
    const totalLiabilities = Math.round(liabilities.reduce((s, a) => s + a.balance, 0) * 100) / 100;
    const equityTotal = Math.round(netAssetsAccounts.reduce((s, a) => s + a.balance, 0) * 100) / 100;

    // Net assets = equity accounts + (revenue - expenses)
    const currentYearSurplus = Math.round((totalRevenue - totalExpenses) * 100) / 100;
    const totalNetAssets = Math.round((equityTotal + currentYearSurplus) * 100) / 100;

    // Add current year surplus to net assets display
    const netAssets = [
      ...netAssetsAccounts,
      ...(currentYearSurplus !== 0
        ? [{ accountNumber: 'CY', name: 'Current Year Surplus / (Deficit)', balance: currentYearSurplus }]
        : []),
    ];

    return {
      assets,
      liabilities,
      netAssets,
      totalAssets,
      totalLiabilities,
      totalNetAssets,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalNetAssets)) < 0.01,
    };
  },

  /**
   * Backfill GL entries from existing income and expense records.
   * Skips any records that already have GL entries (by sourceId).
   */
  backfillFromTransactions: async (
    incomes: Income[],
    expenses: Expense[],
    createdBy: string
  ): Promise<{ posted: number; skipped: number }> => {
    // Get existing GL source IDs to avoid duplicates
    const existingEntries = await generalLedgerApi.getAll();
    const existingSourceIds = new Set(existingEntries.map(e => e.sourceId).filter(Boolean));

    let posted = 0;
    let skipped = 0;

    for (const income of incomes) {
      if (existingSourceIds.has(income.id)) { skipped++; continue; }
      await generalLedgerApi.postIncome(income, createdBy);
      posted++;
    }

    for (const expense of expenses) {
      if (existingSourceIds.has(expense.id)) { skipped++; continue; }
      await generalLedgerApi.postExpense(expense, createdBy);
      posted++;
    }

    return { posted, skipped };
  },
};
