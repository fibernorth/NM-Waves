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
import type { ChartOfAccount, GLAccountType } from '@/types/models';

const COLLECTION = 'chartOfAccounts';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convert = (id: string, data: any): ChartOfAccount => ({
  id,
  accountNumber: data.accountNumber,
  name: data.name,
  type: data.type,
  subtype: data.subtype,
  normalBalance: data.normalBalance,
  description: data.description,
  parentAccountId: data.parentAccountId,
  active: data.active ?? true,
  isSystem: data.isSystem ?? false,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

/**
 * Default nonprofit Chart of Accounts structure.
 * Follows standard nonprofit accounting conventions.
 */
const DEFAULT_ACCOUNTS: Omit<ChartOfAccount, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // ASSETS (1000s)
  { accountNumber: '1000', name: 'Cash - Checking', type: 'asset', subtype: 'cash', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '1010', name: 'Cash - Savings', type: 'asset', subtype: 'cash', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '1020', name: 'Petty Cash', type: 'asset', subtype: 'cash', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '1100', name: 'Accounts Receivable - Player Balances', type: 'asset', subtype: 'accounts_receivable', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '1110', name: 'Accounts Receivable - Sponsors', type: 'asset', subtype: 'accounts_receivable', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '1200', name: 'Prepaid Expenses', type: 'asset', subtype: 'prepaid', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '1500', name: 'Equipment', type: 'asset', subtype: 'equipment_asset', normalBalance: 'debit', active: true, isSystem: true },

  // LIABILITIES (2000s)
  { accountNumber: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'accounts_payable', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '2100', name: 'Accrued Expenses', type: 'liability', subtype: 'accrued_liability', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '2200', name: 'Deferred Revenue - Prepaid Registrations', type: 'liability', subtype: 'deferred_revenue', normalBalance: 'credit', active: true, isSystem: true },

  // NET ASSETS / EQUITY (3000s)
  { accountNumber: '3000', name: 'Unrestricted Net Assets', type: 'equity', subtype: 'unrestricted_net_assets', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '3100', name: 'Temporarily Restricted Net Assets', type: 'equity', subtype: 'restricted_net_assets', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '3900', name: 'Retained Earnings', type: 'equity', subtype: 'retained_earnings', normalBalance: 'credit', active: true, isSystem: true },

  // REVENUE (4000s)
  { accountNumber: '4000', name: 'Player Registration Revenue', type: 'revenue', subtype: 'program_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4010', name: 'Tournament Revenue', type: 'revenue', subtype: 'program_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4100', name: 'Sponsorship Revenue', type: 'revenue', subtype: 'contribution_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4200', name: 'Fundraising Revenue', type: 'revenue', subtype: 'contribution_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4300', name: 'Donation Revenue', type: 'revenue', subtype: 'contribution_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4400', name: 'Grant Revenue', type: 'revenue', subtype: 'grant_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4500', name: 'Merchandise Revenue', type: 'revenue', subtype: 'other_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4600', name: 'Concession Revenue', type: 'revenue', subtype: 'other_revenue', normalBalance: 'credit', active: true, isSystem: true },
  { accountNumber: '4900', name: 'Other Revenue', type: 'revenue', subtype: 'other_revenue', normalBalance: 'credit', active: true, isSystem: true },

  // EXPENSES (5000s - Program, 6000s - Admin, 7000s - Fundraising)
  { accountNumber: '5000', name: 'Facility Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5100', name: 'Equipment Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5200', name: 'Uniform Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5300', name: 'Tournament Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5400', name: 'Travel Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5500', name: 'Insurance Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5600', name: 'League Fees Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5700', name: 'Coaching Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5800', name: 'Maintenance Expense', type: 'expense', subtype: 'program_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '6000', name: 'Administrative Expense', type: 'expense', subtype: 'admin_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '6100', name: 'Marketing Expense', type: 'expense', subtype: 'admin_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '7000', name: 'Fundraising Expense', type: 'expense', subtype: 'fundraising_expense', normalBalance: 'debit', active: true, isSystem: true },
  { accountNumber: '5900', name: 'Other Expense', type: 'expense', subtype: 'other_expense', normalBalance: 'debit', active: true, isSystem: true },
];

/**
 * Maps income categories to default revenue GL account numbers.
 */
export const INCOME_CATEGORY_TO_ACCOUNT: Record<string, string> = {
  player_payments: '4000',
  sponsorships: '4100',
  fundraisers: '4200',
  donations: '4300',
  grants: '4400',
  merchandise: '4500',
  concessions: '4600',
  other: '4900',
};

/**
 * Maps expense categories to default expense GL account numbers.
 */
export const EXPENSE_CATEGORY_TO_ACCOUNT: Record<string, string> = {
  facilities: '5000',
  equipment: '5100',
  uniforms: '5200',
  tournaments: '5300',
  travel: '5400',
  insurance: '5500',
  league_fees: '5600',
  coaching: '5700',
  maintenance: '5800',
  administrative: '6000',
  marketing: '6100',
  fundraising: '7000',
  other: '5900',
};

export const chartOfAccountsApi = {
  getAll: async (): Promise<ChartOfAccount[]> => {
    const q = query(collection(db, COLLECTION), orderBy('accountNumber'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  getActive: async (): Promise<ChartOfAccount[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('active', '==', true),
      orderBy('accountNumber')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  getByType: async (type: GLAccountType): Promise<ChartOfAccount[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('type', '==', type),
      orderBy('accountNumber')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  getByNumber: async (accountNumber: string): Promise<ChartOfAccount | null> => {
    const q = query(
      collection(db, COLLECTION),
      where('accountNumber', '==', accountNumber)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return convert(d.id, d.data());
  },

  getById: async (id: string): Promise<ChartOfAccount | null> => {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? convert(snap.id, snap.data()) : null;
  },

  create: async (data: Omit<ChartOfAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<ChartOfAccount>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData({ ...data, updatedAt: Timestamp.now() }));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Seeds the default nonprofit chart of accounts.
   * Only creates accounts that don't already exist (by accountNumber).
   * Returns count of created accounts.
   */
  seedDefaults: async (): Promise<number> => {
    const existing = await chartOfAccountsApi.getAll();
    const existingNumbers = new Set(existing.map(a => a.accountNumber));

    let created = 0;
    for (const acct of DEFAULT_ACCOUNTS) {
      if (existingNumbers.has(acct.accountNumber)) continue;
      await addDoc(collection(db, COLLECTION), cleanData({
        ...acct,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }));
      created++;
    }
    return created;
  },
};
