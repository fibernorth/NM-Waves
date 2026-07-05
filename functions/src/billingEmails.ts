import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { sendInvoiceNotification, sendPlayerStatement } from './emails';
import { getNextInvoiceNumber } from './invoiceTokens';

const getDb = () => admin.firestore();
const SITE_URL = process.env.SITE_URL || functions.config().app?.site_url || 'https://nmwaves.com';

const computeFeeTotal = (f: any): number =>
  (f.registrationFee || 0) +
  (f.uniformCost || 0) +
  (f.tournamentFees || 0) +
  (f.facilityFees || 0) +
  (f.equipmentFees || 0) +
  (f.otherFees || 0);

/** Collect unique parent/guardian emails for a player from contacts + legacy field. */
async function resolveParentEmails(playerId: string): Promise<{ emails: string[]; parentName: string }> {
  const emails = new Set<string>();
  let parentName = '';
  if (playerId) {
    const playerDoc = await getDb().collection('players').doc(playerId).get();
    if (playerDoc.exists) {
      const p = playerDoc.data()!;
      for (const c of p.contacts || []) {
        if (c && c.email) emails.add(String(c.email).trim().toLowerCase());
        if (!parentName && c && c.name) parentName = String(c.name);
      }
      if (p.parentEmail) emails.add(String(p.parentEmail).trim().toLowerCase());
      if (!parentName && p.parentName) parentName = String(p.parentName);
    }
  }
  return { emails: [...emails].filter((e) => e.includes('@')), parentName };
}

/**
 * Ensure a reusable full-balance pay link exists for a finance record. Reuses an
 * active (unused, unexpired) full_balance token if present; otherwise mints one.
 * Returns the pay URL, or null if there is no balance to collect.
 */
async function ensureFullBalancePayUrl(
  financeId: string,
  playerId: string,
  financeData: any,
  createdBy: string
): Promise<string | null> {
  const totalOwed = computeFeeTotal(financeData);
  const totalPaid = (financeData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const balance = totalOwed - totalPaid - (financeData.scholarshipAmount || 0);
  if (balance <= 0) return null;

  const now = new Date();
  const existing = await getDb()
    .collection('invoiceTokens')
    .where('financeId', '==', financeId)
    .where('chargeType', '==', 'full_balance')
    .get();
  for (const doc of existing.docs) {
    const t = doc.data();
    const notUsed = !t.used;
    const notExpired = !t.expiresAt || (t.expiresAt.toDate?.() ?? new Date(t.expiresAt)) > now;
    if (notUsed && notExpired && t.token) {
      return `${SITE_URL}/pay/${t.token}`;
    }
  }

  // Mint a new full-balance token.
  const token = crypto.randomUUID();
  const invoiceNumber = await getNextInvoiceNumber();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await getDb().collection('invoiceTokens').add({
    financeId,
    playerId,
    playerName: financeData.playerName || '',
    teamName: financeData.teamName || '',
    season: financeData.season || '',
    amountDue: Math.max(0, balance),
    chargeType: 'full_balance',
    chargeLabel: 'Full Balance',
    chargeAmount: 0,
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
    dueDate: admin.firestore.Timestamp.fromDate(expiresAt),
    paymentTerms: 'Net 30',
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    createdBy,
    createdAt: admin.firestore.Timestamp.now(),
    used: false,
  });
  return `${SITE_URL}/pay/${token}`;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  venmo: 'Venmo',
  zelle: 'Zelle',
  card: 'Card',
  credit_card: 'Credit Card',
  bank_transfer: 'Bank Transfer',
  sponsor: 'Sponsor',
  stripe: 'Card (Stripe)',
  other: 'Other',
};

const fmtDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Admin-only: email a single player's parent/guardian either an invoice notice
 * (balance + pay button) or a full account statement (itemized charges and
 * every payment). Resolves recipients from the player's contacts server-side.
 */
export const emailPlayerBilling = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
  const udata = userDoc.data() || {};
  const roles: string[] = udata.roles || (udata.role ? [udata.role] : []);
  if (!roles.includes('admin') && !roles.includes('master-admin')) {
    throw new functions.https.HttpsError('permission-denied', 'Admins only');
  }

  const financeId = String(data?.financeId || '');
  const mode: 'invoice' | 'statement' = data?.mode === 'statement' ? 'statement' : 'invoice';
  if (!financeId) {
    throw new functions.https.HttpsError('invalid-argument', 'financeId is required');
  }

  const financeDoc = await getDb().collection('playerFinances').doc(financeId).get();
  if (!financeDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Finance record not found');
  }
  const f = financeDoc.data()!;
  const playerId = String(f.playerId || '');

  const { emails, parentName } = await resolveParentEmails(playerId);
  if (emails.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'No parent email on file for this player');
  }

  const totalOwed = computeFeeTotal(f);
  const totalPaid = (f.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const scholarshipAmount = f.scholarshipAmount || 0;
  const balanceDue = totalOwed - totalPaid - scholarshipAmount;
  const feeBreakdown = {
    registrationFee: f.registrationFee || 0,
    uniformCost: f.uniformCost || 0,
    tournamentFees: f.tournamentFees || 0,
    facilityFees: f.facilityFees || 0,
    equipmentFees: f.equipmentFees || 0,
    otherFees: f.otherFees || 0,
  };

  const payUrl = await ensureFullBalancePayUrl(financeId, playerId, f, context.auth.uid);

  for (const email of emails) {
    if (mode === 'statement') {
      const payments = (f.payments || [])
        .map((p: any) => ({
          date: fmtDate(p.date?.toDate?.() ?? (p.date ? new Date(p.date) : new Date())),
          _ts: (p.date?.toDate?.() ?? (p.date ? new Date(p.date) : new Date())).getTime(),
          method: PAYMENT_METHOD_LABELS[p.method] || 'Payment',
          reference: p.reference || undefined,
          amount: p.amount || 0,
        }))
        .sort((a: any, b: any) => a._ts - b._ts)
        .map(({ _ts, ...rest }: any) => rest);

      await sendPlayerStatement({
        email,
        parentName,
        playerName: f.playerName || '',
        teamName: f.teamName || '',
        season: f.season || '',
        feeBreakdown,
        totalOwed,
        scholarshipAmount,
        payments,
        totalPaid,
        balanceDue,
        paymentUrl: payUrl || undefined,
        statementDate: fmtDate(new Date()),
      });
    } else {
      await sendInvoiceNotification({
        email,
        parentName,
        playerName: f.playerName || '',
        teamName: f.teamName || '',
        season: f.season || '',
        totalOwed,
        totalPaid,
        balanceDue,
        feeBreakdown,
        scholarshipAmount,
        paymentUrl: payUrl || undefined,
      });
    }
  }

  return { sent: emails.length, recipients: emails, mode };
});
