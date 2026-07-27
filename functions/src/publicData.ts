import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const getDb = () => admin.firestore();

/**
 * Compute fee total from a player finance document.
 * Must match the formula in src/lib/api/finances.ts → computeFeeTotal.
 */
const computeFeeTotal = (data: {
  registrationFee?: number;
  uniformCost?: number;
  tournamentFees?: number;
  facilityFees?: number;
  equipmentFees?: number;
  otherFees?: number;
}): number =>
  (data.registrationFee || 0) +
  (data.uniformCost || 0) +
  (data.tournamentFees || 0) +
  (data.facilityFees || 0) +
  (data.equipmentFees || 0) +
  (data.otherFees || 0);

interface PublicRosterPlayer {
  firstName: string;
  lastInitial: string;
  jerseyNumber: number | null;
  positions: string[];
}

/**
 * Returns a SANITIZED public roster (safe fields only) for a team, callable
 * without authentication so the public site can render rosters. The /players
 * collection itself is not publicly readable — full player docs contain minors'
 * DOB, medical notes, and emergency contacts, which must never cross the wire
 * to anonymous clients.
 */
export const getPublicRoster = functions.https.onCall(
  async (data: { teamId?: string }): Promise<{ players: PublicRosterPlayer[] }> => {
    const teamId = data?.teamId;
    if (!teamId) {
      throw new functions.https.HttpsError('invalid-argument', 'teamId is required');
    }

    const snapshot = await getDb()
      .collection('players')
      .where('teamId', '==', teamId)
      .get();

    const players: PublicRosterPlayer[] = snapshot.docs
      .map((doc) => {
        const p = doc.data();
        return {
          firstName: p.firstName || '',
          lastInitial: p.lastName ? `${String(p.lastName).charAt(0)}.` : '',
          jerseyNumber: p.jerseyNumber ?? null,
          positions: p.positions || [],
        };
      })
      .sort((a, b) => {
        if (a.jerseyNumber != null && b.jerseyNumber != null) {
          return a.jerseyNumber - b.jerseyNumber;
        }
        if (a.jerseyNumber != null) return -1;
        if (b.jerseyNumber != null) return 1;
        return a.firstName.localeCompare(b.firstName);
      });

    return { players };
  }
);

/**
 * Resolves a single invoice by its secret token, callable without
 * authentication so the public payment page works. The invoiceTokens
 * collection is no longer publicly listable (that leaked every child's name,
 * fee breakdown, scholarship amount, and secret token); this returns only the
 * one invoice matching the presented token, plus its live balance computed
 * server-side.
 */
export const getInvoiceByToken = functions.https.onCall(
  async (data: { token?: string }) => {
    const token = data?.token;
    if (!token) {
      throw new functions.https.HttpsError('invalid-argument', 'token is required');
    }

    const tokenQuery = await getDb()
      .collection('invoiceTokens')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (tokenQuery.empty) {
      return { invoice: null };
    }

    const t = tokenQuery.docs[0].data();

    // Compute the live balance from the finance record (Admin SDK bypasses
    // rules) so the page shows an accurate amount even for anonymous payers.
    let liveBalanceDue: number | null = null;
    let liveTotalPaid: number | null = null;
    let liveScholarship: number | null = null;
    if (t.financeId) {
      const financeDoc = await getDb().collection('playerFinances').doc(t.financeId).get();
      if (financeDoc.exists) {
        const f = financeDoc.data()!;
        const owed = computeFeeTotal(f);
        const paid = (f.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
        liveTotalPaid = paid;
        liveScholarship = f.scholarshipAmount || 0;
        liveBalanceDue = owed - paid - (f.scholarshipAmount || 0);
      }
    }

    const toIso = (v: any): string | null =>
      v?.toDate ? v.toDate().toISOString() : (typeof v === 'string' ? v : null);

    // Return the full token data (the caller already holds the secret token, so
    // this is their own invoice) plus a server-computed live balance. Timestamps
    // are serialized to ISO strings for the client to parse back to Dates.
    return {
      invoice: {
        id: tokenQuery.docs[0].id,
        financeId: t.financeId || '',
        playerId: t.playerId || '',
        playerName: t.playerName || '',
        teamName: t.teamName || '',
        season: t.season || '',
        amountDue: t.amountDue ?? 0,
        chargeType: t.chargeType || 'full_balance',
        chargeLabel: t.chargeLabel || 'Full Balance',
        chargeAmount: t.chargeAmount ?? 0,
        registrationFee: t.registrationFee ?? 0,
        uniformCost: t.uniformCost ?? 0,
        tournamentFees: t.tournamentFees ?? 0,
        facilityFees: t.facilityFees ?? 0,
        equipmentFees: t.equipmentFees ?? 0,
        otherFees: t.otherFees ?? 0,
        scholarshipAmount: liveScholarship ?? t.scholarshipAmount ?? 0,
        totalPaid: liveTotalPaid ?? t.totalPaid ?? 0,
        token: t.token,
        invoiceNumber: t.invoiceNumber || null,
        dueDate: toIso(t.dueDate),
        paymentTerms: t.paymentTerms || null,
        expiresAt: toIso(t.expiresAt),
        createdBy: t.createdBy || '',
        createdAt: toIso(t.createdAt),
        used: t.used || false,
        usedAt: toIso(t.usedAt),
        usedBy: t.usedBy || null,
        // Live balance computed server-side (null if no finance record found)
        liveBalanceDue,
      },
    };
  }
);
