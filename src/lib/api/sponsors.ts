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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { arrayUnion } from 'firebase/firestore';
import type { Sponsor, SponsoredPlayer } from '@/types/models';

const COLLECTION = 'sponsors';

const convertSponsor = (id: string, data: any): Sponsor => ({
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
  sponsoredPlayers: (data.sponsoredPlayers || []).map((sp: any) => ({
    playerId: sp.playerId,
    playerName: sp.playerName,
    amount: sp.amount,
    paymentId: sp.paymentId,
    date: sp.date?.toDate() || new Date(),
  })),
  createdAt: data.createdAt?.toDate() || new Date(),
});

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
    return snapshot.docs.map((doc) => convertSponsor(doc.id, doc.data()));
  },

  create: async (data: Omit<Sponsor, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  update: async (id: string, data: Partial<Sponsor>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { ...data });
  },

  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  addSponsoredPlayer: async (sponsorId: string, sponsoredPlayer: SponsoredPlayer): Promise<void> => {
    const docRef = doc(db, COLLECTION, sponsorId);
    await updateDoc(docRef, {
      sponsoredPlayers: arrayUnion({
        ...sponsoredPlayer,
        date: Timestamp.fromDate(sponsoredPlayer.date),
      }),
    });
  },
};
