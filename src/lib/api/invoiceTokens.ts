import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '@/lib/firebase/config';
import type { InvoiceToken } from '@/types/models';

const functions = getFunctions(app);
const COLLECTION = 'invoiceTokens';

const convertToken = (id: string, data: any): InvoiceToken => ({
  id,
  financeId: data.financeId,
  playerId: data.playerId,
  playerName: data.playerName || '',
  teamName: data.teamName || '',
  season: data.season || '',
  amountDue: data.amountDue || 0,
  token: data.token,
  expiresAt: data.expiresAt?.toDate() || new Date(),
  createdBy: data.createdBy || '',
  createdAt: data.createdAt?.toDate() || new Date(),
  used: data.used || false,
  usedAt: data.usedAt?.toDate(),
  usedBy: data.usedBy,
});

export const invoiceTokensApi = {
  /**
   * Generate a new invoice token via Cloud Function (admin only).
   */
  generate: async (financeId: string, playerId: string): Promise<{ token: string; id: string; amountDue: number }> => {
    const callable = httpsCallable<
      { financeId: string; playerId: string },
      { id: string; token: string; amountDue: number; expiresAt: string }
    >(functions, 'generateInvoiceToken');

    const result = await callable({ financeId, playerId });
    return result.data;
  },

  /**
   * Get an invoice token by its UUID token string.
   */
  getByToken: async (token: string): Promise<InvoiceToken | null> => {
    const q = query(
      collection(db, COLLECTION),
      where('token', '==', token)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return convertToken(docSnap.id, docSnap.data());
  },

  /**
   * Get all tokens for a given finance record.
   */
  getByFinance: async (financeId: string): Promise<InvoiceToken[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('financeId', '==', financeId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertToken(d.id, d.data()));
  },

  /**
   * Mark a token as used.
   */
  markUsed: async (tokenId: string, usedBy: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, tokenId);
    await updateDoc(docRef, {
      used: true,
      usedAt: Timestamp.now(),
      usedBy,
    });
  },
};
