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
import type { Sponsor, SponsoredPlayer, SponsorContribution, IncomeCategory } from '@/types/models';

const COLLECTION = 'sponsors';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertSponsor = (id: string, data: any): Sponsor => {
  const contributions = (data.contributions || []).map((c: any) => ({
    id: c.id,
    amount: c.amount,
    date: c.date?.toDate() || new Date(),
    method: c.method || 'other',
    reference: c.reference || '',
    notes: c.notes || '',
    recordedBy: c.recordedBy || '',
    recordedAt: c.recordedAt?.toDate() || new Date(),
  }));

  const totalContributed = contributions.reduce((sum: number, c: any) => sum + c.amount, 0);

  const sponsoredPlayers = (data.sponsoredPlayers || []).map((sp: any) => ({
    playerId: sp.playerId,
    playerName: sp.playerName,
    amount: sp.amount,
    paymentId: sp.paymentId,
    date: sp.date?.toDate() || new Date(),
  }));

  const totalSponsored = sponsoredPlayers.reduce((sum: number, sp: any) => sum + sp.amount, 0);

  return {
    id,
    businessName: data.businessName,
    logoUrl: data.logoUrl || '',
    websiteUrl: data.websiteUrl || '',
    contactName: data.contactName || '',
    contactEmail: data.contactEmail || '',
    contactPhone: data.contactPhone || '',
    level: data.level,
    amount: data.amount || 0,
    displayOnPublicSite: data.displayOnPublicSite ?? false,
    season: data.season,
    contributions,
    totalContributed: data.totalContributed || totalContributed,
    sponsoredPlayers,
    sponsorshipType: data.sponsorshipType || undefined,
    sponsorshipStart: data.sponsorshipStart?.toDate() || undefined,
    sponsorshipEnd: data.sponsorshipEnd?.toDate() || undefined,
    userId: data.userId || undefined,
    stripeCustomerId: data.stripeCustomerId || undefined,
    totalSponsored: data.totalSponsored || totalSponsored,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
};

export const sponsorsApi = {
  getAll: async (): Promise<Sponsor[]> => {
    const q = query(collection(db, COLLECTION), orderBy('businessName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertSponsor(doc.id, doc.data()));
  },

  getBySeason: async (season: string): Promise<Sponsor[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('season', '==', season),
      orderBy('businessName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => convertSponsor(doc.id, doc.data()));
  },

  getPublic: async (): Promise<Sponsor[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('displayOnPublicSite', '==', true),
      orderBy('businessName')
    );
    const snapshot = await getDocs(q);
    const now = new Date();
    return snapshot.docs
      .map((doc) => convertSponsor(doc.id, doc.data()))
      .filter((sponsor) => {
        if (sponsor.sponsorshipStart && now < sponsor.sponsorshipStart) return false;
        if (sponsor.sponsorshipEnd && now > sponsor.sponsorshipEnd) return false;
        return true;
      });
  },

  create: async (data: Omit<Sponsor, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...data,
      createdAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<Sponsor>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = { ...data };
    if (updateData.createdAt instanceof Date) {
      updateData.createdAt = Timestamp.fromDate(updateData.createdAt);
    }
    if (updateData.sponsorshipStart instanceof Date) {
      updateData.sponsorshipStart = Timestamp.fromDate(updateData.sponsorshipStart);
    }
    if (updateData.sponsorshipEnd instanceof Date) {
      updateData.sponsorshipEnd = Timestamp.fromDate(updateData.sponsorshipEnd);
    }
    if (updateData.sponsoredPlayers) {
      updateData.sponsoredPlayers = updateData.sponsoredPlayers.map((sp: any) => ({
        ...sp,
        date: sp.date instanceof Date ? Timestamp.fromDate(sp.date) : sp.date,
      }));
    }
    if (updateData.contributions) {
      updateData.contributions = updateData.contributions.map((c: any) => ({
        ...c,
        date: c.date instanceof Date ? Timestamp.fromDate(c.date) : c.date,
        recordedAt: c.recordedAt instanceof Date ? Timestamp.fromDate(c.recordedAt) : c.recordedAt,
      }));
    }
    await updateDoc(docRef, cleanData(updateData));
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  /** Record a new sponsor contribution (money received from sponsor) */
  addContribution: async (
    sponsorId: string,
    contribution: Omit<SponsorContribution, 'id' | 'recordedAt'>,
    recordedBy: string
  ): Promise<string> => {
    const docRef = doc(db, COLLECTION, sponsorId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Sponsor not found');

    const sponsorData = docSnap.data()!;
    const contributionId = `contrib_${Date.now()}`;
    const now = Timestamp.now();

    const newContribution = {
      id: contributionId,
      amount: contribution.amount,
      date: Timestamp.fromDate(contribution.date),
      method: contribution.method,
      reference: contribution.reference || '',
      notes: contribution.notes || '',
      recordedBy,
      recordedAt: now,
    };

    const contributions = sponsorData.contributions || [];
    contributions.push(newContribution);
    const totalContributed = contributions.reduce((sum: number, c: any) => sum + c.amount, 0);

    await updateDoc(docRef, {
      contributions,
      totalContributed,
      updatedAt: now,
    });

    // Also create an income record
    try {
      const incomeCategory: IncomeCategory = 'sponsorships';
      await addDoc(collection(db, 'income'), cleanData({
        date: Timestamp.fromDate(contribution.date),
        category: incomeCategory,
        amount: contribution.amount,
        source: sponsorData.businessName,
        payerName: sponsorData.contactName || sponsorData.businessName,
        description: `Sponsor contribution from ${sponsorData.businessName}`,
        paymentMethod: contribution.method || 'other',
        referenceNumber: contribution.reference || '',
        season: sponsorData.season || '',
        notes: contribution.notes || '',
        reconciled: false,
        recordedBy,
        createdAt: now,
        updatedAt: now,
      }));
    } catch (err) {
      console.error('[sponsors] Failed to create income record for contribution:', err);
    }

    return contributionId;
  },

  /** Apply sponsor funds to a player (allocate from available balance) */
  addSponsoredPlayer: async (sponsorId: string, sponsoredPlayer: SponsoredPlayer): Promise<void> => {
    const docRef = doc(db, COLLECTION, sponsorId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Sponsor not found');

    const sponsorData = docSnap.data()!;
    const sponsoredPlayers = sponsorData.sponsoredPlayers || [];
    sponsoredPlayers.push({
      ...sponsoredPlayer,
      date: Timestamp.fromDate(sponsoredPlayer.date),
    });
    const totalSponsored = sponsoredPlayers.reduce((sum: number, sp: any) => sum + sp.amount, 0);

    await updateDoc(docRef, {
      sponsoredPlayers,
      totalSponsored,
      updatedAt: Timestamp.now(),
    });
  },
};
