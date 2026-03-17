import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const getDb = () => admin.firestore();

/** Maps charge type keys to human-readable labels */
const CHARGE_LABELS: Record<string, string> = {
  registrationFee: 'Registration Fee',
  uniformCost: 'Uniform Cost',
  tournamentFees: 'Tournament Fees',
  facilityFees: 'Facility Fees',
  equipmentFees: 'Equipment Fees',
  otherFees: 'Other Fees',
  full_balance: 'Full Balance',
};

interface GenerateTokenParams {
  financeId: string;
  playerId: string;
  chargeType?: string; // e.g. 'registrationFee', 'uniformCost', or omit for full balance
  expiryDays?: number;
  dueDate?: string;       // ISO date string for due date
  paymentTerms?: string;  // e.g. 'Net 30', 'Due upon receipt'
}

interface BatchGenerateParams {
  season?: string;        // Filter by season (defaults to current year)
  teamId?: string;        // Filter by team (optional)
  expiryDays?: number;    // Token expiry (default 30)
  dueDate?: string;       // ISO date for due date
  paymentTerms?: string;  // e.g. 'Net 30'
}

/** Charge type fields on PlayerFinance that can be invoiced individually */
const CHARGE_FIELDS = Object.keys(CHARGE_LABELS).filter(k => k !== 'full_balance');

/**
 * Atomically increment the invoice counter and return a formatted invoice number.
 * Format: INV-YYYY-XXXX (year + zero-padded sequence)
 */
async function getNextInvoiceNumber(): Promise<string> {
  const counterRef = getDb().collection('appSettings').doc('invoiceCounter');
  const year = new Date().getFullYear();

  const result = await getDb().runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let currentCount = 0;
    let currentYear = year;

    if (counterDoc.exists) {
      const data = counterDoc.data()!;
      currentYear = data.year || year;
      currentCount = data.count || 0;
    }

    // Reset counter if year changed
    if (currentYear !== year) {
      currentCount = 0;
    }

    const nextCount = currentCount + 1;
    transaction.set(counterRef, { year, count: nextCount }, { merge: true });

    return nextCount;
  });

  const padded = String(result).padStart(4, '0');
  return `INV-${year}-${padded}`;
}

/**
 * Generates a unique invoice token for QR code payments.
 * Admin only. Creates a token doc in the invoiceTokens collection.
 *
 * If chargeType is provided, creates an invoice for that single charge.
 * If omitted, creates a full-balance invoice.
 */
export const generateInvoiceToken = functions.https.onCall(
  async (data: GenerateTokenParams, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    // Check admin role
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || !(userData.roles?.some((r: string) => ['admin', 'master-admin'].includes(r)) || ['admin', 'master-admin'].includes(userData.role))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { financeId, playerId, chargeType, expiryDays = 30, dueDate, paymentTerms = 'Net 30' } = data;

    if (!financeId || !playerId) {
      throw new functions.https.HttpsError('invalid-argument', 'financeId and playerId required');
    }

    // Validate chargeType if provided (allow omit for full_balance)
    if (chargeType && chargeType !== 'full_balance' && !CHARGE_LABELS[chargeType]) {
      throw new functions.https.HttpsError('invalid-argument', `Invalid chargeType: ${chargeType}`);
    }

    // Validate dueDate if provided
    if (dueDate) {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid dueDate format: ${dueDate}`);
      }
    }

    // Fetch finance record for player info
    const financeDoc = await getDb().collection('playerFinances').doc(financeId).get();
    if (!financeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Finance record not found');
    }

    const financeData = financeDoc.data()!;

    // Calculate amounts
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

    const fullBalance = totalOwed - totalPaid - (financeData.scholarshipAmount || 0);

    // Determine invoice amount
    let amountDue: number;
    let chargeLabel: string;
    let chargeAmount: number;

    if (chargeType) {
      // Per-charge invoice
      chargeAmount = financeData[chargeType] || 0;
      chargeLabel = CHARGE_LABELS[chargeType];
      amountDue = chargeAmount;
    } else {
      // Full balance invoice
      chargeAmount = 0;
      chargeLabel = 'Full Balance';
      amountDue = fullBalance;
    }

    // Generate UUID token and sequential invoice number
    const token = crypto.randomUUID();
    const invoiceNumber = await getNextInvoiceNumber();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Calculate due date: use provided dueDate or default to expiryDays from now
    const dueDateValue = dueDate ? new Date(dueDate) : new Date(expiresAt);

    const tokenDoc: Record<string, any> = {
      financeId,
      playerId,
      playerName: financeData.playerName || '',
      teamName: financeData.teamName || '',
      season: financeData.season || '',
      amountDue: Math.max(0, amountDue),
      chargeType: chargeType || 'full_balance',
      chargeLabel,
      chargeAmount,
      // Include full breakdown for context on the invoice
      registrationFee: financeData.registrationFee || 0,
      uniformCost: financeData.uniformCost || 0,
      tournamentFees: financeData.tournamentFees || 0,
      facilityFees: financeData.facilityFees || 0,
      equipmentFees: financeData.equipmentFees || 0,
      otherFees: financeData.otherFees || 0,
      scholarshipAmount: financeData.scholarshipAmount || 0,
      totalPaid,
      token,
      invoiceNumber,
      dueDate: admin.firestore.Timestamp.fromDate(dueDateValue),
      paymentTerms,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdBy: context.auth.uid,
      createdAt: admin.firestore.Timestamp.now(),
      used: false,
    };

    const docRef = await getDb().collection('invoiceTokens').add(tokenDoc);

    return {
      id: docRef.id,
      token,
      invoiceNumber,
      amountDue: Math.max(0, amountDue),
      chargeType: chargeType || 'full_balance',
      chargeLabel,
      dueDate: dueDateValue.toISOString(),
      paymentTerms,
      expiresAt: expiresAt.toISOString(),
    };
  }
);

/**
 * Batch-generates invoices for all players with outstanding balances.
 * For each player, creates a separate invoice per charge type that has a balance > 0,
 * skipping any charge that already has an active (unused, unexpired) invoice.
 *
 * Admin only. Returns summary of created/skipped counts.
 */
export const batchGenerateInvoices = functions.https.onCall(
  async (data: BatchGenerateParams, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    // Check admin role
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || !(userData.roles?.some((r: string) => ['admin', 'master-admin'].includes(r)) || ['admin', 'master-admin'].includes(userData.role))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const {
      season = new Date().getFullYear().toString(),
      teamId,
      expiryDays = 30,
      dueDate,
      paymentTerms = 'Net 30',
    } = data;

    // Validate dueDate if provided
    if (dueDate) {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', `Invalid dueDate format: ${dueDate}`);
      }
    }

    const db = getDb();

    // 1. Fetch all PlayerFinance records for the season
    let financesQuery: FirebaseFirestore.Query = db
      .collection('playerFinances')
      .where('season', '==', season);

    if (teamId) {
      financesQuery = financesQuery.where('teamId', '==', teamId);
    }

    const financesSnapshot = await financesQuery.get();

    // 2. Fetch all existing active (unused + unexpired) invoice tokens for this season
    const now = new Date();
    const existingTokensSnapshot = await db
      .collection('invoiceTokens')
      .where('season', '==', season)
      .where('used', '==', false)
      .get();

    // Build a set of "playerId:chargeType" keys for active invoices
    const activeInvoiceKeys = new Set<string>();
    existingTokensSnapshot.forEach((doc) => {
      const t = doc.data();
      const expiresAt = t.expiresAt?.toDate ? t.expiresAt.toDate() : new Date(t.expiresAt);
      if (expiresAt > now) {
        activeInvoiceKeys.add(`${t.playerId}:${t.chargeType}`);
      }
    });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    const dueDateValue = dueDate ? new Date(dueDate) : new Date(expiresAt);

    for (const financeDoc of financesSnapshot.docs) {
      const financeData = financeDoc.data();
      const playerId = financeData.playerId;

      // Calculate total paid
      const totalPaid = (financeData.payments || []).reduce(
        (sum: number, p: any) => sum + (p.amount || 0),
        0
      );

      // For each charge type, check if there's a balance and no active invoice
      for (const chargeType of CHARGE_FIELDS) {
        const chargeAmount = financeData[chargeType] || 0;
        if (chargeAmount <= 0) continue;

        // Check duplicate: skip if active invoice exists for this player+charge
        const key = `${playerId}:${chargeType}`;
        if (activeInvoiceKeys.has(key)) {
          skipped++;
          continue;
        }

        try {
          const token = crypto.randomUUID();
          const invoiceNumber = await getNextInvoiceNumber();

          const tokenDoc: Record<string, any> = {
            financeId: financeDoc.id,
            playerId,
            playerName: financeData.playerName || '',
            teamName: financeData.teamName || '',
            season: financeData.season || '',
            amountDue: chargeAmount,
            chargeType,
            chargeLabel: CHARGE_LABELS[chargeType],
            chargeAmount,
            registrationFee: financeData.registrationFee || 0,
            uniformCost: financeData.uniformCost || 0,
            tournamentFees: financeData.tournamentFees || 0,
            facilityFees: financeData.facilityFees || 0,
            equipmentFees: financeData.equipmentFees || 0,
            otherFees: financeData.otherFees || 0,
            scholarshipAmount: financeData.scholarshipAmount || 0,
            totalPaid,
            token,
            invoiceNumber,
            dueDate: admin.firestore.Timestamp.fromDate(dueDateValue),
            paymentTerms,
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            createdBy: context.auth!.uid,
            createdAt: admin.firestore.Timestamp.now(),
            used: false,
          };

          await db.collection('invoiceTokens').add(tokenDoc);
          // Track to prevent duplicates within same batch
          activeInvoiceKeys.add(key);
          created++;
        } catch (err: any) {
          errors.push(`${financeData.playerName} - ${CHARGE_LABELS[chargeType]}: ${err.message}`);
        }
      }
    }

    return { created, skipped, errors, season };
  }
);
