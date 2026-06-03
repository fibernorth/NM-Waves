import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { FixedAsset } from '@/types/models';
import { generalLedgerApi } from './generalLedger';

const COLLECTION = 'fixedAssets';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convert = (id: string, data: any): FixedAsset => ({
  id,
  name: data.name,
  description: data.description,
  category: data.category,
  purchaseDate: data.purchaseDate?.toDate() || new Date(),
  purchaseCost: data.purchaseCost || 0,
  salvageValue: data.salvageValue || 0,
  usefulLifeYears: data.usefulLifeYears || 1,
  depreciationMethod: data.depreciationMethod || 'straight_line',
  assetAccountNumber: data.assetAccountNumber || '1500',
  depreciationExpenseAccount: data.depreciationExpenseAccount || '5100',
  accumulatedDepreciation: data.accumulatedDepreciation || 0,
  status: data.status || 'active',
  disposedDate: data.disposedDate?.toDate(),
  disposedAmount: data.disposedAmount,
  notes: data.notes,
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

// ============================================
// Depreciation Helpers
// ============================================

/**
 * Calculate monthly depreciation for an asset using straight-line method.
 * Formula: (purchaseCost - salvageValue) / (usefulLifeYears * 12)
 */
export function calculateMonthlyDepreciation(asset: FixedAsset): number {
  if (asset.usefulLifeYears <= 0) return 0;
  const depreciableAmount = asset.purchaseCost - asset.salvageValue;
  if (depreciableAmount <= 0) return 0;
  return Math.round((depreciableAmount / (asset.usefulLifeYears * 12)) * 100) / 100;
}

/**
 * Returns the full depreciation schedule for an asset (one entry per month).
 */
export function getDepreciationSchedule(asset: FixedAsset): Array<{
  month: number;
  date: Date;
  monthlyAmount: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}> {
  const monthly = calculateMonthlyDepreciation(asset);
  if (monthly <= 0) return [];

  const totalMonths = asset.usefulLifeYears * 12;
  const depreciableAmount = asset.purchaseCost - asset.salvageValue;
  const schedule: Array<{
    month: number;
    date: Date;
    monthlyAmount: number;
    accumulatedDepreciation: number;
    netBookValue: number;
  }> = [];

  let accumulated = 0;
  const startDate = new Date(asset.purchaseDate);

  for (let i = 0; i < totalMonths; i++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 1);
    // Last month gets the remainder to avoid rounding drift
    const amount = i === totalMonths - 1
      ? Math.round((depreciableAmount - accumulated) * 100) / 100
      : monthly;
    accumulated = Math.round((accumulated + amount) * 100) / 100;
    const netBookValue = Math.round((asset.purchaseCost - accumulated) * 100) / 100;

    schedule.push({
      month: i + 1,
      date,
      monthlyAmount: amount,
      accumulatedDepreciation: accumulated,
      netBookValue,
    });
  }

  return schedule;
}

// ============================================
// API
// ============================================

export const fixedAssetsApi = {
  getAll: async (): Promise<FixedAsset[]> => {
    const q = query(collection(db, COLLECTION), orderBy('purchaseDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convert(d.id, d.data()));
  },

  getById: async (id: string): Promise<FixedAsset | null> => {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convert(docSnap.id, docSnap.data()) : null;
  },

  create: async (
    data: Omit<FixedAsset, 'id' | 'accumulatedDepreciation' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...data,
      purchaseDate: Timestamp.fromDate(data.purchaseDate),
      disposedDate: data.disposedDate ? Timestamp.fromDate(data.disposedDate) : null,
      accumulatedDepreciation: 0,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<FixedAsset>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };
    if (data.purchaseDate) {
      updateData.purchaseDate = Timestamp.fromDate(data.purchaseDate);
    }
    if (data.disposedDate) {
      updateData.disposedDate = Timestamp.fromDate(data.disposedDate);
    }
    await updateDoc(docRef, cleanData(updateData));
  },

  /** Soft-delete: set status to 'disposed' */
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, cleanData({
      status: 'disposed',
      disposedDate: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
  },

  /**
   * Record one month of depreciation for an asset.
   * Creates a double-entry GL journal:
   *   Debit: Depreciation Expense account
   *   Credit: Accumulated Depreciation contra-asset account (1500 by convention)
   * Then updates the accumulatedDepreciation on the asset.
   */
  recordDepreciation: async (
    assetId: string,
    amount: number,
    date: Date,
    createdBy: string,
  ): Promise<void> => {
    const asset = await fixedAssetsApi.getById(assetId);
    if (!asset) throw new Error('Asset not found');
    if (asset.status !== 'active') throw new Error('Asset is not active');

    const maxDepreciation = asset.purchaseCost - asset.salvageValue;
    const newAccumulated = asset.accumulatedDepreciation + amount;
    if (newAccumulated > maxDepreciation + 0.01) {
      throw new Error('Depreciation would exceed depreciable amount');
    }

    // Determine the season from the date (use the year)
    const season = date.getFullYear().toString();

    // Post GL entry: Debit depreciation expense, Credit accumulated depreciation contra-asset
    await generalLedgerApi.postJournalEntry({
      date,
      debitAccountNumber: asset.depreciationExpenseAccount,
      creditAccountNumber: asset.assetAccountNumber,
      amount,
      memo: `Monthly depreciation - ${asset.name}`,
      season,
      createdBy,
    });

    // Update asset accumulated depreciation
    const roundedNew = Math.round(newAccumulated * 100) / 100;
    const updates: Partial<FixedAsset> = {
      accumulatedDepreciation: roundedNew,
    };

    // Check if fully depreciated
    if (Math.abs(roundedNew - maxDepreciation) < 0.01) {
      updates.status = 'fully_depreciated';
    }

    await fixedAssetsApi.update(assetId, updates);
  },

  /** Calculate monthly depreciation (convenience re-export) */
  calculateMonthlyDepreciation,

  /** Get depreciation schedule (convenience re-export) */
  getDepreciationSchedule,
};
