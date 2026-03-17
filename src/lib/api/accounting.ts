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
import type {
  Expense,
  Income,
  Budget,
  Account,
  Vendor,
  FinancialSummary,
  ExpenseCategory,
  IncomeCategory,
} from '@/types/models';
import { computeFeeTotal } from './finances';

// Collection names
const EXPENSES_COLLECTION = 'expenses';
const INCOME_COLLECTION = 'income';
const BUDGETS_COLLECTION = 'budgets';

/**
 * Flexible season matching: "2026" matches "2026", "2025-2026", "2026-2027".
 * Also handles "2025-2026" matching "2025" or "2026".
 */
export const matchesSeason = (recordSeason: string, filterSeason: string): boolean => {
  if (!recordSeason || !filterSeason) return false;
  if (recordSeason === filterSeason) return true;
  // "2026" matches "2025-2026" or "2026-2027"
  if (recordSeason.includes('-')) {
    const parts = recordSeason.split('-');
    return parts.includes(filterSeason);
  }
  // "2025-2026" filter matches "2025" or "2026"
  if (filterSeason.includes('-')) {
    const parts = filterSeason.split('-');
    return parts.includes(recordSeason);
  }
  return false;
};
const ACCOUNTS_COLLECTION = 'accounts';
const VENDORS_COLLECTION = 'vendors';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

// ============================================
// EXPENSES API
// ============================================

const convertExpense = (id: string, data: any): Expense => ({
  id,
  date: data.date?.toDate() || new Date(),
  category: data.category,
  amount: data.amount,
  vendor: data.vendor,
  description: data.description,
  paymentMethod: data.paymentMethod,
  checkNumber: data.checkNumber,
  receiptUrl: data.receiptUrl,
  teamId: data.teamId,
  teamName: data.teamName,
  playerId: data.playerId,
  playerName: data.playerName,
  tournamentId: data.tournamentId,
  tournamentName: data.tournamentName,
  season: data.season,
  isPaid: data.isPaid,
  paidDate: data.paidDate?.toDate(),
  notes: data.notes,
  reconciled: data.reconciled || false,
  reconciledAt: data.reconciledAt?.toDate(),
  reconciledBy: data.reconciledBy,
  recordedBy: data.recordedBy,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const expensesApi = {
  getAll: async (): Promise<Expense[]> => {
    const q = query(collection(db, EXPENSES_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertExpense(doc.id, doc.data()));
  },

  getBySeason: async (season: string): Promise<Expense[]> => {
    const snapshot = await getDocs(query(collection(db, EXPENSES_COLLECTION), orderBy('date', 'desc')));
    return snapshot.docs
      .map(doc => convertExpense(doc.id, doc.data()))
      .filter(e => matchesSeason(e.season, season));
  },

  getByTeam: async (teamId: string): Promise<Expense[]> => {
    const q = query(
      collection(db, EXPENSES_COLLECTION),
      where('teamId', '==', teamId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertExpense(doc.id, doc.data()));
  },

  getByCategory: async (category: ExpenseCategory, season?: string): Promise<Expense[]> => {
    let q;
    if (season) {
      q = query(
        collection(db, EXPENSES_COLLECTION),
        where('category', '==', category),
        where('season', '==', season),
        orderBy('date', 'desc')
      );
    } else {
      q = query(
        collection(db, EXPENSES_COLLECTION),
        where('category', '==', category),
        orderBy('date', 'desc')
      );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertExpense(doc.id, doc.data()));
  },

  getUnpaid: async (): Promise<Expense[]> => {
    const q = query(
      collection(db, EXPENSES_COLLECTION),
      where('isPaid', '==', false),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertExpense(doc.id, doc.data()));
  },

  getByDateRange: async (from: Date, to: Date): Promise<Expense[]> => {
    const q = query(
      collection(db, EXPENSES_COLLECTION),
      where('date', '>=', Timestamp.fromDate(from)),
      where('date', '<=', Timestamp.fromDate(to)),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertExpense(doc.id, doc.data()));
  },

  getById: async (id: string): Promise<Expense | null> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertExpense(docSnap.id, docSnap.data()) : null;
  },

  create: async (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, EXPENSES_COLLECTION), cleanData({
      ...expenseData,
      date: Timestamp.fromDate(expenseData.date),
      paidDate: expenseData.paidDate ? Timestamp.fromDate(expenseData.paidDate) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));

    // Auto-post GL entries (best-effort — won't fail if COA not set up yet)
    try {
      const { generalLedgerApi } = await import('./generalLedger');
      const expenseRecord: Expense = {
        ...expenseData,
        id: docRef.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await generalLedgerApi.postExpense(expenseRecord, expenseData.recordedBy);
    } catch (err) {
      console.warn('[accounting] GL posting skipped for expense:', err);
    }

    return docRef.id;
  },

  update: async (id: string, expenseData: Partial<Expense>): Promise<void> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    const updateData: any = {
      ...expenseData,
      updatedAt: Timestamp.now(),
    };

    if (expenseData.date) {
      updateData.date = Timestamp.fromDate(expenseData.date);
    }
    if (expenseData.paidDate) {
      updateData.paidDate = Timestamp.fromDate(expenseData.paidDate);
    }

    await updateDoc(docRef, cleanData(updateData));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await deleteDoc(docRef);
  },

  markAsPaid: async (id: string, paidDate: Date): Promise<void> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, cleanData({
      isPaid: true,
      paidDate: Timestamp.fromDate(paidDate),
      updatedAt: Timestamp.now(),
    }));
  },
};

// ============================================
// INCOME API
// ============================================

const convertIncome = (id: string, data: any): Income => ({
  id,
  date: data.date?.toDate() || new Date(),
  category: data.category,
  amount: data.amount,
  source: data.source,
  payerName: data.payerName || '',
  description: data.description,
  paymentMethod: data.paymentMethod,
  checkNumber: data.checkNumber,
  referenceNumber: data.referenceNumber,
  teamId: data.teamId,
  playerId: data.playerId,
  season: data.season,
  notes: data.notes,
  reconciled: data.reconciled || false,
  reconciledAt: data.reconciledAt?.toDate(),
  reconciledBy: data.reconciledBy,
  recordedBy: data.recordedBy,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const incomeApi = {
  getAll: async (): Promise<Income[]> => {
    const q = query(collection(db, INCOME_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertIncome(doc.id, doc.data()));
  },

  getBySeason: async (season: string): Promise<Income[]> => {
    const snapshot = await getDocs(query(collection(db, INCOME_COLLECTION), orderBy('date', 'desc')));
    return snapshot.docs
      .map(doc => convertIncome(doc.id, doc.data()))
      .filter(i => matchesSeason(i.season, season));
  },

  getByTeam: async (teamId: string): Promise<Income[]> => {
    const q = query(
      collection(db, INCOME_COLLECTION),
      where('teamId', '==', teamId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertIncome(doc.id, doc.data()));
  },

  getByCategory: async (category: IncomeCategory, season?: string): Promise<Income[]> => {
    let q;
    if (season) {
      q = query(
        collection(db, INCOME_COLLECTION),
        where('category', '==', category),
        where('season', '==', season),
        orderBy('date', 'desc')
      );
    } else {
      q = query(
        collection(db, INCOME_COLLECTION),
        where('category', '==', category),
        orderBy('date', 'desc')
      );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertIncome(doc.id, doc.data()));
  },

  getByDateRange: async (from: Date, to: Date): Promise<Income[]> => {
    const q = query(
      collection(db, INCOME_COLLECTION),
      where('date', '>=', Timestamp.fromDate(from)),
      where('date', '<=', Timestamp.fromDate(to)),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertIncome(doc.id, doc.data()));
  },

  getById: async (id: string): Promise<Income | null> => {
    const docRef = doc(db, INCOME_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertIncome(docSnap.id, docSnap.data()) : null;
  },

  create: async (incomeData: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, INCOME_COLLECTION), cleanData({
      ...incomeData,
      date: Timestamp.fromDate(incomeData.date),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));

    // Auto-post GL entries (best-effort — won't fail if COA not set up yet)
    try {
      const { generalLedgerApi } = await import('./generalLedger');
      const incomeRecord: Income = {
        ...incomeData,
        id: docRef.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await generalLedgerApi.postIncome(incomeRecord, incomeData.recordedBy);
    } catch (err) {
      console.warn('[accounting] GL posting skipped for income:', err);
    }

    return docRef.id;
  },

  update: async (id: string, incomeData: Partial<Income>): Promise<void> => {
    const docRef = doc(db, INCOME_COLLECTION, id);
    const updateData: any = {
      ...incomeData,
      updatedAt: Timestamp.now(),
    };

    if (incomeData.date) {
      updateData.date = Timestamp.fromDate(incomeData.date);
    }

    await updateDoc(docRef, cleanData(updateData));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, INCOME_COLLECTION, id);
    await deleteDoc(docRef);
  },
};

// ============================================
// BUDGETS API
// ============================================

const convertBudget = (id: string, data: any): Budget => ({
  id,
  season: data.season,
  teamId: data.teamId,
  teamName: data.teamName,
  plannedIncome: data.plannedIncome,
  plannedExpenses: data.plannedExpenses,
  actualIncome: data.actualIncome,
  actualExpenses: data.actualExpenses,
  variance: data.variance,
  notes: data.notes,
  createdBy: data.createdBy,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const budgetsApi = {
  getAll: async (): Promise<Budget[]> => {
    const q = query(collection(db, BUDGETS_COLLECTION), orderBy('season', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertBudget(doc.id, doc.data()));
  },

  getBySeason: async (season: string): Promise<Budget[]> => {
    // Fetch all budgets and filter client-side for flexible season matching
    const snapshot = await getDocs(collection(db, BUDGETS_COLLECTION));
    return snapshot.docs
      .map(doc => convertBudget(doc.id, doc.data()))
      .filter(b => matchesSeason(b.season, season));
  },

  getByTeam: async (teamId: string): Promise<Budget[]> => {
    const q = query(
      collection(db, BUDGETS_COLLECTION),
      where('teamId', '==', teamId),
      orderBy('season', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertBudget(doc.id, doc.data()));
  },

  getById: async (id: string): Promise<Budget | null> => {
    const docRef = doc(db, BUDGETS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertBudget(docSnap.id, docSnap.data()) : null;
  },

  create: async (budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, BUDGETS_COLLECTION), cleanData({
      ...budgetData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, budgetData: Partial<Budget>): Promise<void> => {
    const docRef = doc(db, BUDGETS_COLLECTION, id);
    await updateDoc(docRef, cleanData({
      ...budgetData,
      updatedAt: Timestamp.now(),
    }));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, BUDGETS_COLLECTION, id);
    await deleteDoc(docRef);
  },
};

// ============================================
// ACCOUNTS API
// ============================================

const convertAccount = (id: string, data: any): Account => ({
  id,
  name: data.name,
  type: data.type,
  accountNumber: data.accountNumber,
  bankName: data.bankName,
  balance: data.balance,
  lastReconciled: data.lastReconciled?.toDate(),
  active: data.active,
  notes: data.notes,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const accountsApi = {
  getAll: async (): Promise<Account[]> => {
    const q = query(collection(db, ACCOUNTS_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertAccount(doc.id, doc.data()));
  },

  getActive: async (): Promise<Account[]> => {
    const q = query(
      collection(db, ACCOUNTS_COLLECTION),
      where('active', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertAccount(doc.id, doc.data()));
  },

  getById: async (id: string): Promise<Account | null> => {
    const docRef = doc(db, ACCOUNTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertAccount(docSnap.id, docSnap.data()) : null;
  },

  create: async (accountData: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, ACCOUNTS_COLLECTION), cleanData({
      ...accountData,
      lastReconciled: accountData.lastReconciled ? Timestamp.fromDate(accountData.lastReconciled) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, accountData: Partial<Account>): Promise<void> => {
    const docRef = doc(db, ACCOUNTS_COLLECTION, id);
    const updateData: any = {
      ...accountData,
      updatedAt: Timestamp.now(),
    };

    if (accountData.lastReconciled) {
      updateData.lastReconciled = Timestamp.fromDate(accountData.lastReconciled);
    }

    await updateDoc(docRef, cleanData(updateData));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, ACCOUNTS_COLLECTION, id);
    await deleteDoc(docRef);
  },
};

// ============================================
// VENDORS API
// ============================================

const convertVendor = (id: string, data: any): Vendor => ({
  id,
  name: data.name,
  category: data.category,
  contactName: data.contactName,
  email: data.email,
  phone: data.phone,
  address: data.address,
  website: data.website,
  notes: data.notes,
  active: data.active,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const vendorsApi = {
  getAll: async (): Promise<Vendor[]> => {
    const q = query(collection(db, VENDORS_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertVendor(doc.id, doc.data()));
  },

  getActive: async (): Promise<Vendor[]> => {
    const q = query(
      collection(db, VENDORS_COLLECTION),
      where('active', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertVendor(doc.id, doc.data()));
  },

  getByCategory: async (category: ExpenseCategory): Promise<Vendor[]> => {
    const q = query(
      collection(db, VENDORS_COLLECTION),
      where('category', '==', category),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertVendor(doc.id, doc.data()));
  },

  getById: async (id: string): Promise<Vendor | null> => {
    const docRef = doc(db, VENDORS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertVendor(docSnap.id, docSnap.data()) : null;
  },

  create: async (vendorData: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, VENDORS_COLLECTION), cleanData({
      ...vendorData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, vendorData: Partial<Vendor>): Promise<void> => {
    const docRef = doc(db, VENDORS_COLLECTION, id);
    await updateDoc(docRef, cleanData({
      ...vendorData,
      updatedAt: Timestamp.now(),
    }));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, VENDORS_COLLECTION, id);
    await deleteDoc(docRef);
  },
};

// ============================================
// RECONCILIATION HELPERS
// ============================================

export const reconciliationApi = {
  reconcileIncome: async (id: string, userId: string): Promise<void> => {
    const docRef = doc(db, INCOME_COLLECTION, id);
    await updateDoc(docRef, cleanData({
      reconciled: true,
      reconciledAt: Timestamp.now(),
      reconciledBy: userId,
      updatedAt: Timestamp.now(),
    }));
  },

  unreconcileIncome: async (id: string): Promise<void> => {
    const docRef = doc(db, INCOME_COLLECTION, id);
    await updateDoc(docRef, cleanData({
      reconciled: false,
      reconciledAt: null,
      reconciledBy: null,
      updatedAt: Timestamp.now(),
    }));
  },

  reconcileExpense: async (id: string, userId: string): Promise<void> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, cleanData({
      reconciled: true,
      reconciledAt: Timestamp.now(),
      reconciledBy: userId,
      updatedAt: Timestamp.now(),
    }));
  },

  unreconcileExpense: async (id: string): Promise<void> => {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, cleanData({
      reconciled: false,
      reconciledAt: null,
      reconciledBy: null,
      updatedAt: Timestamp.now(),
    }));
  },
};

// ============================================
// FINANCIAL REPORTS / ANALYTICS
// ============================================

export const reportsApi = {
  /**
   * Generate a financial summary report for a given period
   */
  generateSummary: async (
    season: string,
    teamId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FinancialSummary> => {
    // Fetch income and expenses, then filter client-side for flexible season matching
    const incomeQuery = teamId
      ? query(collection(db, INCOME_COLLECTION), where('teamId', '==', teamId))
      : query(collection(db, INCOME_COLLECTION));

    const expensesQuery = teamId
      ? query(collection(db, EXPENSES_COLLECTION), where('teamId', '==', teamId))
      : query(collection(db, EXPENSES_COLLECTION));

    const [incomeSnapshot, expensesSnapshot] = await Promise.all([
      getDocs(incomeQuery),
      getDocs(expensesQuery),
    ]);

    const allIncomes = incomeSnapshot.docs.map(doc => convertIncome(doc.id, doc.data()));
    const allExpenses = expensesSnapshot.docs.map(doc => convertExpense(doc.id, doc.data()));

    // Flexible season matching
    const incomes = season ? allIncomes.filter(i => matchesSeason(i.season, season)) : allIncomes;
    const expenses = season ? allExpenses.filter(e => matchesSeason(e.season, season)) : allExpenses;

    // Calculate income by category
    const income = {
      playerPayments: incomes
        .filter(i => i.category === 'player_payments')
        .reduce((sum, i) => sum + i.amount, 0),
      sponsorships: incomes
        .filter(i => i.category === 'sponsorships')
        .reduce((sum, i) => sum + i.amount, 0),
      fundraisers: incomes
        .filter(i => i.category === 'fundraisers')
        .reduce((sum, i) => sum + i.amount, 0),
      donations: incomes
        .filter(i => i.category === 'donations')
        .reduce((sum, i) => sum + i.amount, 0),
      grants: incomes
        .filter(i => i.category === 'grants')
        .reduce((sum, i) => sum + i.amount, 0),
      merchandise: incomes
        .filter(i => i.category === 'merchandise')
        .reduce((sum, i) => sum + i.amount, 0),
      concessions: incomes
        .filter(i => i.category === 'concessions')
        .reduce((sum, i) => sum + i.amount, 0),
      other: incomes
        .filter(i => i.category === 'other')
        .reduce((sum, i) => sum + i.amount, 0),
      total: 0,
    };
    income.total = income.playerPayments + income.sponsorships + income.fundraisers + income.donations + income.grants + income.merchandise + income.concessions + income.other;

    // Calculate expenses by category
    const expensesBreakdown = {
      facilities: expenses
        .filter(e => e.category === 'facilities')
        .reduce((sum, e) => sum + e.amount, 0),
      equipment: expenses
        .filter(e => e.category === 'equipment')
        .reduce((sum, e) => sum + e.amount, 0),
      uniforms: expenses
        .filter(e => e.category === 'uniforms')
        .reduce((sum, e) => sum + e.amount, 0),
      tournaments: expenses
        .filter(e => e.category === 'tournaments')
        .reduce((sum, e) => sum + e.amount, 0),
      travel: expenses
        .filter(e => e.category === 'travel')
        .reduce((sum, e) => sum + e.amount, 0),
      insurance: expenses
        .filter(e => e.category === 'insurance')
        .reduce((sum, e) => sum + e.amount, 0),
      leagueFees: expenses
        .filter(e => e.category === 'league_fees')
        .reduce((sum, e) => sum + e.amount, 0),
      coaching: expenses
        .filter(e => e.category === 'coaching')
        .reduce((sum, e) => sum + e.amount, 0),
      administrative: expenses
        .filter(e => e.category === 'administrative')
        .reduce((sum, e) => sum + e.amount, 0),
      processingFees: expenses
        .filter(e => e.category === 'processing_fees')
        .reduce((sum, e) => sum + e.amount, 0),
      marketing: expenses
        .filter(e => e.category === 'marketing')
        .reduce((sum, e) => sum + e.amount, 0),
      fundraising: expenses
        .filter(e => e.category === 'fundraising')
        .reduce((sum, e) => sum + e.amount, 0),
      maintenance: expenses
        .filter(e => e.category === 'maintenance')
        .reduce((sum, e) => sum + e.amount, 0),
      other: expenses
        .filter(e => e.category === 'other')
        .reduce((sum, e) => sum + e.amount, 0),
      total: 0,
    };
    expensesBreakdown.total = expensesBreakdown.facilities + expensesBreakdown.equipment + expensesBreakdown.uniforms + expensesBreakdown.tournaments + expensesBreakdown.travel + expensesBreakdown.insurance + expensesBreakdown.leagueFees + expensesBreakdown.coaching + expensesBreakdown.administrative + expensesBreakdown.processingFees + expensesBreakdown.marketing + expensesBreakdown.fundraising + expensesBreakdown.maintenance + expensesBreakdown.other;

    const netIncome = income.total - expensesBreakdown.total;
    const outstandingPayables = expenses
      .filter(e => !e.isPaid)
      .reduce((sum, e) => sum + e.amount, 0);

    // Compute outstanding receivables from player finances.
    // playerFinances use team-style seasons ("2025-2026") while reports
    // filter by plain year ("2026"), so we match flexibly.
    let outstandingReceivables = 0;
    try {
      const pfQuery = teamId
        ? query(collection(db, 'playerFinances'), where('teamId', '==', teamId))
        : query(collection(db, 'playerFinances'));
      const pfSnapshot = await getDocs(pfQuery);
      for (const pfDoc of pfSnapshot.docs) {
        const d = pfDoc.data();
        if (d.season && !matchesSeason(d.season, season)) continue;
        const owed = computeFeeTotal(d);
        const paid = (d.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
        const scholarship = d.scholarshipAmount || 0;
        const due = owed - paid - scholarship;
        if (due > 0) outstandingReceivables += due;
      }
    } catch {
      // Gracefully degrade if player finances fetch fails
    }

    return {
      season,
      teamId,
      startDate: startDate || new Date(),
      endDate: endDate || new Date(),
      income,
      expenses: expensesBreakdown,
      netIncome,
      outstandingPayables,
      outstandingReceivables,
    };
  },
};
