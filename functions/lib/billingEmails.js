"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailOutstandingInvoices = exports.emailPlayerBilling = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const emails_1 = require("./emails");
const invoiceTokens_1 = require("./invoiceTokens");
const getDb = () => admin.firestore();
const SITE_URL = process.env.SITE_URL || ((_a = functions.config().app) === null || _a === void 0 ? void 0 : _a.site_url) || 'https://nmwaves.com';
const computeFeeTotal = (f) => (f.registrationFee || 0) +
    (f.uniformCost || 0) +
    (f.tournamentFees || 0) +
    (f.facilityFees || 0) +
    (f.equipmentFees || 0) +
    (f.otherFees || 0);
/** Collect unique parent/guardian emails for a player from contacts + legacy field. */
async function resolveParentEmails(playerId) {
    const emails = new Set();
    let parentName = '';
    if (playerId) {
        const playerDoc = await getDb().collection('players').doc(playerId).get();
        if (playerDoc.exists) {
            const p = playerDoc.data();
            for (const c of p.contacts || []) {
                if (c && c.email)
                    emails.add(String(c.email).trim().toLowerCase());
                if (!parentName && c && c.name)
                    parentName = String(c.name);
            }
            if (p.parentEmail)
                emails.add(String(p.parentEmail).trim().toLowerCase());
            if (!parentName && p.parentName)
                parentName = String(p.parentName);
        }
    }
    return { emails: [...emails].filter((e) => e.includes('@')), parentName };
}
/**
 * Ensure a reusable full-balance pay link exists for a finance record. Reuses an
 * active (unused, unexpired) full_balance token if present; otherwise mints one.
 * Returns the pay URL, or null if there is no balance to collect.
 */
async function ensureFullBalancePayUrl(financeId, playerId, financeData, createdBy) {
    var _a, _b, _c;
    const totalOwed = computeFeeTotal(financeData);
    const totalPaid = (financeData.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const balance = totalOwed - totalPaid - (financeData.scholarshipAmount || 0);
    if (balance <= 0)
        return null;
    const now = new Date();
    const existing = await getDb()
        .collection('invoiceTokens')
        .where('financeId', '==', financeId)
        .where('chargeType', '==', 'full_balance')
        .get();
    for (const doc of existing.docs) {
        const t = doc.data();
        const notUsed = !t.used;
        const notExpired = !t.expiresAt || ((_c = (_b = (_a = t.expiresAt).toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : new Date(t.expiresAt)) > now;
        if (notUsed && notExpired && t.token) {
            return `${SITE_URL}/pay/${t.token}`;
        }
    }
    // Mint a new full-balance token.
    const token = crypto.randomUUID();
    const invoiceNumber = await (0, invoiceTokens_1.getNextInvoiceNumber)();
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
const PAYMENT_METHOD_LABELS = {
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
const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
/**
 * Admin-only: email a single player's parent/guardian either an invoice notice
 * (balance + pay button) or a full account statement (itemized charges and
 * every payment). Resolves recipients from the player's contacts server-side.
 */
exports.emailPlayerBilling = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    const udata = userDoc.data() || {};
    const roles = udata.roles || (udata.role ? [udata.role] : []);
    if (!roles.includes('admin') && !roles.includes('master-admin')) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only');
    }
    const financeId = String((data === null || data === void 0 ? void 0 : data.financeId) || '');
    const mode = (data === null || data === void 0 ? void 0 : data.mode) === 'statement' ? 'statement' : 'invoice';
    if (!financeId) {
        throw new functions.https.HttpsError('invalid-argument', 'financeId is required');
    }
    const financeDoc = await getDb().collection('playerFinances').doc(financeId).get();
    if (!financeDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Finance record not found');
    }
    const f = financeDoc.data();
    const playerId = String(f.playerId || '');
    const { emails, parentName } = await resolveParentEmails(playerId);
    if (emails.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No parent email on file for this player');
    }
    const totalOwed = computeFeeTotal(f);
    const totalPaid = (f.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
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
                .map((p) => {
                var _a, _b, _c, _d, _e, _f;
                return ({
                    date: fmtDate((_c = (_b = (_a = p.date) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : (p.date ? new Date(p.date) : new Date())),
                    _ts: ((_f = (_e = (_d = p.date) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) !== null && _f !== void 0 ? _f : (p.date ? new Date(p.date) : new Date())).getTime(),
                    method: PAYMENT_METHOD_LABELS[p.method] || 'Payment',
                    reference: p.reference || undefined,
                    amount: p.amount || 0,
                });
            })
                .sort((a, b) => a._ts - b._ts)
                .map(({ _ts, ...rest }) => rest);
            await (0, emails_1.sendPlayerStatement)({
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
        }
        else {
            await (0, emails_1.sendInvoiceNotification)({
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
/**
 * Admin-only: email an invoice notice to EVERY player with an outstanding
 * balance in one action. For each such player it resolves the parent email(s),
 * reuses or mints a pay link, and sends the branded invoice. Players with no
 * balance, quit players, or players with no email on file are skipped and
 * reported back so nothing fails silently.
 */
exports.emailOutstandingInvoices = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    const udata = userDoc.data() || {};
    const roles = udata.roles || (udata.role ? [udata.role] : []);
    if (!roles.includes('admin') && !roles.includes('master-admin')) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only');
    }
    const snap = await getDb().collection('playerFinances').get();
    let emailed = 0;
    let skippedNoBalance = 0;
    const skippedNoEmail = [];
    const players = [];
    for (const doc of snap.docs) {
        const f = doc.data();
        if (f.status === 'quit') {
            skippedNoBalance++;
            continue;
        }
        const totalOwed = computeFeeTotal(f);
        const totalPaid = (f.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
        const scholarshipAmount = f.scholarshipAmount || 0;
        const balanceDue = totalOwed - totalPaid - scholarshipAmount;
        if (balanceDue <= 0.005) {
            skippedNoBalance++;
            continue;
        }
        const playerId = String(f.playerId || '');
        const { emails, parentName } = await resolveParentEmails(playerId);
        if (emails.length === 0) {
            skippedNoEmail.push(f.playerName || playerId);
            continue;
        }
        const payUrl = await ensureFullBalancePayUrl(doc.id, playerId, f, context.auth.uid);
        const feeBreakdown = {
            registrationFee: f.registrationFee || 0,
            uniformCost: f.uniformCost || 0,
            tournamentFees: f.tournamentFees || 0,
            facilityFees: f.facilityFees || 0,
            equipmentFees: f.equipmentFees || 0,
            otherFees: f.otherFees || 0,
        };
        for (const email of emails) {
            await (0, emails_1.sendInvoiceNotification)({
                email, parentName,
                playerName: f.playerName || '',
                teamName: f.teamName || '',
                season: f.season || '',
                totalOwed, totalPaid, balanceDue, feeBreakdown, scholarshipAmount,
                paymentUrl: payUrl || undefined,
            });
        }
        emailed++;
        players.push(f.playerName || playerId);
    }
    return { emailed, players, skippedNoBalance, skippedNoEmail };
});
//# sourceMappingURL=billingEmails.js.map