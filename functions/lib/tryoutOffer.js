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
exports.sendTryoutOffer = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const emails_1 = require("./emails");
const getDb = () => admin.firestore();
/**
 * Coach/admin action: email a tryout applicant's family a branded offer
 * ("your player has been offered a spot") and mark the applicant invited.
 * Sending and the status flip happen together so "invited" always means
 * the family was actually notified.
 */
exports.sendTryoutOffer = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    const udata = userDoc.data() || {};
    const roles = udata.roles || (udata.role ? [udata.role] : []);
    if (!roles.includes('admin') && !roles.includes('master-admin') && !roles.includes('coach')) {
        throw new functions.https.HttpsError('permission-denied', 'Coaches and admins only');
    }
    const applicantId = String((data === null || data === void 0 ? void 0 : data.applicantId) || '').trim();
    if (!applicantId) {
        throw new functions.https.HttpsError('invalid-argument', 'applicantId is required');
    }
    const applicantRef = getDb().collection('tryout-applicants').doc(applicantId);
    const applicantDoc = await applicantRef.get();
    if (!applicantDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Tryout applicant not found');
    }
    const a = applicantDoc.data() || {};
    const email = String(a.email || '').trim();
    if (!email) {
        throw new functions.https.HttpsError('failed-precondition', 'This applicant has no email address on file');
    }
    const playerName = [a.playerFirstName, a.playerLastName].filter(Boolean).join(' ').trim() || 'Your player';
    await (0, emails_1.sendTryoutOfferEmail)({
        email,
        parentName: String(a.parentName || ''),
        playerName,
        ageGroup: String(a.ageGroup || ''),
        sessionLabel: a.sessionLabel ? String(a.sessionLabel) : undefined,
    });
    await applicantRef.update({ status: 'invited' });
    return { sent: true, email };
});
//# sourceMappingURL=tryoutOffer.js.map