import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Fundraiser, FundraiserDonation } from '@/types/models';

const COLLECTION = 'fundraisers';

const convertFundraiser = (id: string, data: any): Fundraiser => ({
  id,
  name: data.name,
  description: data.description || '',
  goal: data.goal || 0,
  currentAmount: data.currentAmount || 0,
  teamId: data.teamId,
  status: data.status || 'active',
  donations: (data.donations || []).map((d: any) => ({
    payerName: d.payerName,
    amount: d.amount,
    method: d.method,
    date: d.date?.toDate ? d.date.toDate() : new Date(d.date),
  })),
  startDate: data.startDate?.toDate() || undefined,
  endDate: data.endDate?.toDate() || undefined,
  createdAt: data.createdAt?.toDate() || new Date(),
});

export const fundraisersApi = {
  getAll: async (): Promise<Fundraiser[]> => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertFundraiser(doc.id, doc.data()));
  },

  getActive: async (): Promise<Fundraiser[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertFundraiser(doc.id, doc.data()));
  },

  create: async (data: Omit<Fundraiser, 'id' | 'createdAt' | 'donations' | 'currentAmount'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      currentAmount: 0,
      donations: [],
      startDate: data.startDate ? Timestamp.fromDate(data.startDate) : null,
      endDate: data.endDate ? Timestamp.fromDate(data.endDate) : null,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  update: async (id: string, data: Partial<Fundraiser>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...data };
    if (data.startDate) {
      updateData.startDate = Timestamp.fromDate(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = Timestamp.fromDate(data.endDate);
    }
    // Remove donations from partial update - use addDonation instead
    delete updateData.donations;
    await updateDoc(docRef, updateData);
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  addDonation: async (id: string, donation: FundraiserDonation, newTotal: number): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      donations: arrayUnion({
        ...donation,
        date: Timestamp.fromDate(donation.date),
      }),
      currentAmount: newTotal,
    });
  },
};
