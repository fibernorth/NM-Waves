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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoiceByToken = exports.getPublicRoster = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const getDb = () => admin.firestore();
/**
 * Compute fee total from a player finance document.
 * Must match the formula in src/lib/api/finances.ts → computeFeeTotal.
 */
const computeFeeTotal = (data) => (data.registrationFee || 0) +
    (data.uniformCost || 0) +
    (data.tournamentFees || 0) +
    (data.facilityFees || 0) +
    (data.equipmentFees || 0) +
    (data.otherFees || 0);
/**
 * Returns a SANITIZED public roster (safe fields only) for a team, callable
 * without authentication so the public site can render rosters. The /players
 * collection itself is not publicly readable — full player docs contain minors'
 * DOB, medical notes, and emergency contacts, which must never cross the wire
 * to anonymous clients.
 */
exports.getPublicRoster = functions.https.onCall(async (data) => {
    const teamId = data === null || data === void 0 ? void 0 : data.teamId;
    if (!teamId) {
        throw new functions.https.HttpsError('invalid-argument', 'teamId is required');
    }
    const snapshot = await getDb()
        .collection('players')
        .where('teamId', '==', teamId)
        .get();
    const players = snapshot.docs
        .map((doc) => {
        var _a;
        const p = doc.data();
        return {
            firstName: p.firstName || '',
            lastInitial: p.lastName ? `${String(p.lastName).charAt(0)}.` : '',
            jerseyNumber: (_a = p.jerseyNumber) !== null && _a !== void 0 ? _a : null,
            positions: p.positions || [],
        };
    })
        .sort((a, b) => {
        if (a.jerseyNumber != null && b.jerseyNumber != null) {
            return a.jerseyNumber - b.jerseyNumber;
        }
        if (a.jerseyNumber != null)
            return -1;
        if (b.jerseyNumber != null)
            return 1;
        return a.firstName.localeCompare(b.firstName);
    });
    return { players };
});
/**
 * Resolves a single invoice by its secret token, callable without
 * authentication so the public payment page works. The invoiceTokens
 * collection is no longer publicly listable (that leaked every child's name,
 * fee breakdown, scholarship amount, and secret token); this returns only the
 * one invoice matching the presented token, plus its live balance computed
 * server-side.
 */
exports.getInvoiceByToken = functions.https.onCall(async (data) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const token = data === null || data === void 0 ? void 0 : data.token;
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
    let liveBalanceDue = null;
    let liveTotalPaid = null;
    let liveScholarship = null;
    if (t.financeId) {
        const financeDoc = await getDb().collection('playerFinances').doc(t.financeId).get();
        if (financeDoc.exists) {
            const f = financeDoc.data();
            const owed = computeFeeTotal(f);
            const paid = (f.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
            liveTotalPaid = paid;
            liveScholarship = f.scholarshipAmount || 0;
            liveBalanceDue = owed - paid - (f.scholarshipAmount || 0);
        }
    }
    const toIso = (v) => (v === null || v === void 0 ? void 0 : v.toDate) ? v.toDate().toISOString() : (typeof v === 'string' ? v : null);
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
            amountDue: (_a = t.amountDue) !== null && _a !== void 0 ? _a : 0,
            chargeType: t.chargeType || 'full_balance',
            chargeLabel: t.chargeLabel || 'Full Balance',
            chargeAmount: (_b = t.chargeAmount) !== null && _b !== void 0 ? _b : 0,
            registrationFee: (_c = t.registrationFee) !== null && _c !== void 0 ? _c : 0,
            uniformCost: (_d = t.uniformCost) !== null && _d !== void 0 ? _d : 0,
            tournamentFees: (_e = t.tournamentFees) !== null && _e !== void 0 ? _e : 0,
            facilityFees: (_f = t.facilityFees) !== null && _f !== void 0 ? _f : 0,
            equipmentFees: (_g = t.equipmentFees) !== null && _g !== void 0 ? _g : 0,
            otherFees: (_h = t.otherFees) !== null && _h !== void 0 ? _h : 0,
            scholarshipAmount: (_j = liveScholarship !== null && liveScholarship !== void 0 ? liveScholarship : t.scholarshipAmount) !== null && _j !== void 0 ? _j : 0,
            totalPaid: (_k = liveTotalPaid !== null && liveTotalPaid !== void 0 ? liveTotalPaid : t.totalPaid) !== null && _k !== void 0 ? _k : 0,
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
});
//# sourceMappingURL=publicData.js.map