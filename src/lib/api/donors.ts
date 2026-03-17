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
import type { Donor, DonorReceipt } from '@/types/models';

const DONORS_COLLECTION = 'donors';
const RECEIPTS_COLLECTION = 'donorReceipts';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

// ============================================
// DONORS
// ============================================

const convertDonor = (id: string, data: any): Donor => ({
  id,
  name: data.name,
  type: data.type || 'individual',
  email: data.email,
  phone: data.phone,
  address: data.address,
  city: data.city,
  state: data.state,
  zip: data.zip,
  notes: data.notes,
  totalGiven: data.totalGiven || 0,
  donationCount: data.donationCount || 0,
  firstDonationDate: data.firstDonationDate?.toDate(),
  lastDonationDate: data.lastDonationDate?.toDate(),
  active: data.active ?? true,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const donorsApi = {
  getAll: async (): Promise<Donor[]> => {
    const q = query(collection(db, DONORS_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertDonor(d.id, d.data()));
  },

  getById: async (id: string): Promise<Donor | null> => {
    const snap = await getDoc(doc(db, DONORS_COLLECTION, id));
    return snap.exists() ? convertDonor(snap.id, snap.data()) : null;
  },

  create: async (data: Omit<Donor, 'id' | 'createdAt' | 'updatedAt' | 'totalGiven' | 'donationCount'>): Promise<string> => {
    const docRef = await addDoc(collection(db, DONORS_COLLECTION), cleanData({
      ...data,
      totalGiven: 0,
      donationCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<Donor>): Promise<void> => {
    const docRef = doc(db, DONORS_COLLECTION, id);
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.firstDonationDate) updateData.firstDonationDate = Timestamp.fromDate(data.firstDonationDate);
    if (data.lastDonationDate) updateData.lastDonationDate = Timestamp.fromDate(data.lastDonationDate);
    await updateDoc(docRef, cleanData(updateData));
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, DONORS_COLLECTION, id));
  },

  /**
   * Record a donation and update donor totals.
   */
  recordDonation: async (donorId: string, amount: number, date: Date): Promise<void> => {
    const donor = await donorsApi.getById(donorId);
    if (!donor) throw new Error('Donor not found');

    const updates: Partial<Donor> = {
      totalGiven: donor.totalGiven + amount,
      donationCount: donor.donationCount + 1,
      lastDonationDate: date,
    };
    if (!donor.firstDonationDate) {
      updates.firstDonationDate = date;
    }
    await donorsApi.update(donorId, updates);
  },
};

// ============================================
// DONOR RECEIPTS
// ============================================

const convertReceipt = (id: string, data: any): DonorReceipt => ({
  id,
  donorId: data.donorId,
  donorName: data.donorName,
  donorAddress: data.donorAddress,
  amount: data.amount,
  date: data.date?.toDate() || new Date(),
  description: data.description,
  receiptNumber: data.receiptNumber,
  taxYear: data.taxYear,
  goodsOrServicesProvided: data.goodsOrServicesProvided || false,
  goodsOrServicesDescription: data.goodsOrServicesDescription,
  goodsOrServicesValue: data.goodsOrServicesValue,
  orgName: data.orgName,
  orgEIN: data.orgEIN,
  orgAddress: data.orgAddress,
  sentAt: data.sentAt?.toDate(),
  createdBy: data.createdBy,
  createdAt: data.createdAt?.toDate() || new Date(),
});

/**
 * Get next receipt number: REC-YYYY-XXXX
 */
async function getNextReceiptNumber(taxYear: number): Promise<string> {
  const q = query(
    collection(db, RECEIPTS_COLLECTION),
    where('taxYear', '==', taxYear)
  );
  const snapshot = await getDocs(q);
  const nextNum = snapshot.size + 1;
  return `REC-${taxYear}-${String(nextNum).padStart(4, '0')}`;
}

export const donorReceiptsApi = {
  getAll: async (): Promise<DonorReceipt[]> => {
    const q = query(collection(db, RECEIPTS_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertReceipt(d.id, d.data()));
  },

  getByDonor: async (donorId: string): Promise<DonorReceipt[]> => {
    const q = query(
      collection(db, RECEIPTS_COLLECTION),
      where('donorId', '==', donorId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertReceipt(d.id, d.data()));
  },

  getByTaxYear: async (taxYear: number): Promise<DonorReceipt[]> => {
    const q = query(
      collection(db, RECEIPTS_COLLECTION),
      where('taxYear', '==', taxYear),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertReceipt(d.id, d.data()));
  },

  /**
   * Generate an IRS-compliant donation receipt for a donor.
   */
  generate: async (params: {
    donorId: string;
    donorName: string;
    donorAddress?: string;
    amount: number;
    date: Date;
    description: string;
    goodsOrServicesProvided?: boolean;
    goodsOrServicesDescription?: string;
    goodsOrServicesValue?: number;
    orgName: string;
    orgEIN: string;
    orgAddress: string;
    createdBy: string;
  }): Promise<DonorReceipt> => {
    const taxYear = params.date.getFullYear();
    const receiptNumber = await getNextReceiptNumber(taxYear);

    const receiptData = {
      ...params,
      receiptNumber,
      taxYear,
      goodsOrServicesProvided: params.goodsOrServicesProvided || false,
      date: Timestamp.fromDate(params.date),
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, RECEIPTS_COLLECTION), cleanData(receiptData));

    return {
      ...params,
      id: docRef.id,
      receiptNumber,
      taxYear,
      goodsOrServicesProvided: params.goodsOrServicesProvided || false,
      createdAt: new Date(),
    };
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, RECEIPTS_COLLECTION, id));
  },

  /**
   * Generate printable HTML for a donation receipt.
   */
  generateReceiptHTML: (receipt: DonorReceipt): string => {
    const deductibleAmount = receipt.goodsOrServicesProvided
      ? receipt.amount - (receipt.goodsOrServicesValue || 0)
      : receipt.amount;

    return `
      <html>
      <head><title>Donation Receipt ${receipt.receiptNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #001f5b; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { color: #001f5b; margin: 0; }
        .receipt-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .section { margin-bottom: 20px; }
        .amount { font-size: 1.5em; font-weight: bold; color: #001f5b; }
        .legal { font-size: 0.85em; color: #666; border-top: 1px solid #ccc; padding-top: 15px; margin-top: 30px; }
      </style></head>
      <body>
        <div class="header">
          <h1>${receipt.orgName}</h1>
          <p>Tax-Exempt Organization | EIN: ${receipt.orgEIN}</p>
          <p>${receipt.orgAddress}</p>
        </div>
        <h2>Donation Receipt</h2>
        <div class="receipt-info">
          <div><strong>Receipt #:</strong> ${receipt.receiptNumber}</div>
          <div><strong>Date:</strong> ${receipt.date.toLocaleDateString()}</div>
        </div>
        <div class="section">
          <h3>Donor Information</h3>
          <p><strong>${receipt.donorName}</strong></p>
          ${receipt.donorAddress ? `<p>${receipt.donorAddress}</p>` : ''}
        </div>
        <div class="section">
          <h3>Donation Details</h3>
          <p>${receipt.description}</p>
          <p class="amount">Amount: $${receipt.amount.toFixed(2)}</p>
          ${receipt.goodsOrServicesProvided ? `
            <p><strong>Goods/Services Provided:</strong> ${receipt.goodsOrServicesDescription || 'Yes'}</p>
            <p><strong>Fair Market Value:</strong> $${(receipt.goodsOrServicesValue || 0).toFixed(2)}</p>
            <p><strong>Tax-Deductible Amount:</strong> $${deductibleAmount.toFixed(2)}</p>
          ` : `
            <p>No goods or services were provided in exchange for this contribution.</p>
          `}
        </div>
        <div class="legal">
          <p>${receipt.orgName} is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code.
          Your contribution is tax-deductible to the extent allowed by law. Please retain this receipt for your tax records.</p>
          <p>Tax Year: ${receipt.taxYear}</p>
        </div>
      </body></html>
    `;
  },
};
