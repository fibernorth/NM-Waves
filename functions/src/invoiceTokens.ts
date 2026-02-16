import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

interface GenerateTokenParams {
  financeId: string;
  playerId: string;
  expiryDays?: number;
}

/**
 * Generates a unique invoice token for QR code payments.
 * Admin only. Creates a token doc in the invoiceTokens collection.
 */
export const generateInvoiceToken = functions.https.onCall(
  async (data: GenerateTokenParams, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    // Check admin role
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || !['admin', 'master-admin'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { financeId, playerId, expiryDays = 30 } = data;

    if (!financeId || !playerId) {
      throw new functions.https.HttpsError('invalid-argument', 'financeId and playerId required');
    }

    // Fetch finance record for player info
    const financeDoc = await db.collection('playerFinances').doc(financeId).get();
    if (!financeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Finance record not found');
    }

    const financeData = financeDoc.data()!;

    // Calculate balance due
    const totalOwed =
      (financeData.registrationFee || 0) +
      (financeData.uniformCost || 0) +
      (financeData.tournamentFees || 0) +
      (financeData.facilityFees || 0) +
      (financeData.equipmentFees || 0) +
      (financeData.otherFees || 0);

    const totalPaid = (financeData.payments || []).reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0
    );

    const amountDue = totalOwed - totalPaid - (financeData.scholarshipAmount || 0);

    // Generate UUID token
    const token = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const tokenDoc = {
      financeId,
      playerId,
      playerName: financeData.playerName || '',
      teamName: financeData.teamName || '',
      season: financeData.season || '',
      amountDue: Math.max(0, amountDue),
      token,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdBy: context.auth.uid,
      createdAt: admin.firestore.Timestamp.now(),
      used: false,
    };

    const docRef = await db.collection('invoiceTokens').add(tokenDoc);

    return {
      id: docRef.id,
      token,
      amountDue: Math.max(0, amountDue),
      expiresAt: expiresAt.toISOString(),
    };
  }
);
