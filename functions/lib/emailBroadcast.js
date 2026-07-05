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
exports.emailAllParents = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const emails_1 = require("./emails");
const getDb = () => admin.firestore();
/**
 * Admin-only broadcast: email active players' parent/guardian contacts.
 * With no filters, targets ALL active players. Optional filters narrow the
 * audience: teamIds (players on any selected team) and/or playerIds
 * (individually selected players) — the audience is the union of both.
 * Gathers unique emails from players' contacts (and the legacy parentEmail
 * field) and sends one branded message via the club's Gmail.
 */
exports.emailAllParents = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    const udata = userDoc.data() || {};
    const roles = udata.roles || (udata.role ? [udata.role] : []);
    if (!roles.includes('admin') && !roles.includes('master-admin')) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only');
    }
    const subject = String((data === null || data === void 0 ? void 0 : data.subject) || '').trim();
    const message = String((data === null || data === void 0 ? void 0 : data.message) || '').trim();
    if (!subject || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'Subject and message are required');
    }
    const emails = new Set();
    if (data === null || data === void 0 ? void 0 : data.tryoutSignups) {
        // Audience: everyone who registered for tryouts (their contact email).
        const snap = await getDb().collection('tryout-applicants').get();
        for (const doc of snap.docs) {
            const a = doc.data();
            if (a.email)
                emails.add(String(a.email).trim().toLowerCase());
        }
    }
    else {
        const teamIds = Array.isArray(data === null || data === void 0 ? void 0 : data.teamIds) ? data.teamIds.map(String) : [];
        const playerIds = Array.isArray(data === null || data === void 0 ? void 0 : data.playerIds) ? data.playerIds.map(String) : [];
        const filtered = teamIds.length > 0 || playerIds.length > 0;
        const teamIdSet = new Set(teamIds);
        const playerIdSet = new Set(playerIds);
        // Note: read all players and skip quit — do not rely on an `active` flag.
        const snap = await getDb().collection('players').get();
        for (const doc of snap.docs) {
            const p = doc.data();
            if (p.status === 'quit')
                continue;
            if (filtered && !teamIdSet.has(p.teamId) && !playerIdSet.has(doc.id))
                continue;
            for (const c of p.contacts || []) {
                if (c && c.email)
                    emails.add(String(c.email).trim().toLowerCase());
            }
            if (p.parentEmail)
                emails.add(String(p.parentEmail).trim().toLowerCase());
        }
    }
    const recipients = [...emails].filter((e) => e.includes('@'));
    if (recipients.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No email addresses found for the selected recipients');
    }
    const result = await (0, emails_1.sendBroadcastEmail)(recipients, subject, message);
    return { recipientCount: recipients.length, ...result };
});
//# sourceMappingURL=emailBroadcast.js.map