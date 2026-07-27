import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import Fuse from 'fuse.js';
import type { Sponsor, Income } from '@/types/models';

/**
 * Get a sponsor record by their Firebase Auth user ID.
 */
export async function getSponsorByUserId(uid: string): Promise<Sponsor | null> {
  const q = query(
    collection(db, 'sponsors'),
    where('userId', '==', uid)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
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
    userId: data.userId,
    stripeCustomerId: data.stripeCustomerId,
    totalSponsored: data.totalSponsored || 0,
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

/**
 * Get payment history for a specific sponsor (income records matching their business name).
 */
export async function getSponsorPaymentHistory(sponsorId: string): Promise<Income[]> {
  // First get the sponsor to find their business name
  const sponsorDoc = await getDocs(query(
    collection(db, 'sponsors'),
    where('__name__', '==', sponsorId)
  ));
  if (sponsorDoc.empty) return [];
  const sponsorData = sponsorDoc.docs[0].data();
  const businessName = sponsorData.businessName;

  // Query income records matching this sponsor's business name
  const q = query(
    collection(db, 'income'),
    where('category', '==', 'sponsorships'),
    where('source', '==', businessName),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        date: data.date?.toDate() || new Date(),
        category: data.category,
        amount: data.amount,
        source: data.source,
        description: data.description,
        payerName: data.payerName || '',
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
      } as Income;
    });
}

interface PlayerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  teamId?: string;
  teamName?: string;
}

/**
 * Fuzzy-search players by name using Fuse.js.
 * Returns the top 10 matches.
 */
export async function searchPlayers(queryText: string): Promise<PlayerSearchResult[]> {
  const q = query(
    collection(db, 'players'),
    where('active', '==', true),
    orderBy('lastName')
  );
  const snapshot = await getDocs(q);

  const players: PlayerSearchResult[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`,
      teamId: data.teamId,
      teamName: data.teamName,
    };
  });

  if (!queryText.trim()) return players.slice(0, 10);

  const fuse = new Fuse(players, {
    keys: ['fullName', 'firstName', 'lastName'],
    threshold: 0.4,
    includeScore: true,
  });

  return fuse.search(queryText).slice(0, 10).map((r) => r.item);
}

/**
 * Get the balance summary for a player (what a sponsor would see).
 */
export async function getPlayerFinanceSummary(playerId: string): Promise<{
  playerName: string;
  teamName: string;
  season: string;
  balanceDue: number;
  financeId: string;
} | null> {
  // Resolved via Cloud Function: sponsors no longer have direct read access to
  // the full playerFinances documents (payment history, other payers' details).
  // The function returns only the minimal balance summary needed to pay.
  const callable = httpsCallable<
    { playerId: string },
    {
      summary: {
        playerName: string;
        teamName: string;
        season: string;
        balanceDue: number;
        financeId: string;
      } | null;
    }
  >(functions, 'getPlayerFinanceSummary');
  const result = await callable({ playerId });
  return result.data?.summary ?? null;
}
