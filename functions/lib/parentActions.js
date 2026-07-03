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
exports.getPlayerFinanceSummary = exports.updateLinkedPlayerContact = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const getDb = () => admin.firestore();
/**
 * Lets a parent update the contact / emergency / medical fields on a player
 * they are linked to. Parents cannot write the /players collection directly
 * (that is coach-only), so onboarding "Save & Continue" used to always fail
 * with a permissions error. This callable enforces that the caller is a parent
 * linked to the player and writes ONLY the allowed fields — never roster,
 * financial, or team assignment fields.
 */
exports.updateLinkedPlayerContact = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { playerId } = data;
    if (!playerId) {
        throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }
    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Unknown user');
    }
    const userData = userDoc.data();
    const roles = userData.roles || (userData.role ? [userData.role] : []);
    const linkedPlayerIds = userData.linkedPlayerIds || [];
    const isParent = roles.includes('parent');
    const isLinked = linkedPlayerIds.includes(playerId);
    if (!isParent || !isLinked) {
        throw new functions.https.HttpsError('permission-denied', 'You can only update a child linked to your account');
    }
    // Whitelist of fields a parent may update — nothing else is written.
    const allowed = { updatedAt: admin.firestore.Timestamp.now() };
    if (data.parentName !== undefined)
        allowed.parentName = data.parentName;
    if (data.parentEmail !== undefined)
        allowed.parentEmail = data.parentEmail;
    if (data.parentPhone !== undefined)
        allowed.parentPhone = data.parentPhone;
    if (data.emergencyContact !== undefined)
        allowed.emergencyContact = data.emergencyContact;
    if (data.emergencyPhone !== undefined)
        allowed.emergencyPhone = data.emergencyPhone;
    if (data.medicalNotes !== undefined)
        allowed.medicalNotes = data.medicalNotes;
    if (Array.isArray(data.contacts)) {
        allowed.contacts = data.contacts.map((c) => ({
            name: c.name || '',
            relationship: c.relationship || '',
            email: c.email || '',
            phone: c.phone || '',
            isPrimaryContact: c.isPrimaryContact || false,
            isFinancialParty: c.isFinancialParty || false,
        }));
    }
    await getDb().collection('players').doc(playerId).update(allowed);
    return { success: true };
});
/**
 * Returns a MINIMAL finance summary (name, team, season, balance due) for a
 * player, to any authenticated user. Used by the sponsor "pay a player" flow so
 * a sponsor can see the outstanding balance of the player they want to fund —
 * without granting sponsors read access to the full playerFinances documents
 * (which contain every payer's name/email and the whole payment history).
 */
exports.getPlayerFinanceSummary = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { playerId } = data;
    if (!playerId) {
        throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }
    const snapshot = await getDb()
        .collection('playerFinances')
        .where('playerId', '==', playerId)
        .orderBy('season', 'desc')
        .get();
    if (snapshot.empty)
        return { summary: null };
    const docSnap = snapshot.docs[0];
    const d = docSnap.data();
    const totalOwed = (d.registrationFee || 0) +
        (d.uniformCost || 0) +
        (d.tournamentFees || 0) +
        (d.facilityFees || 0) +
        (d.equipmentFees || 0) +
        (d.otherFees || 0);
    const totalPaid = (d.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const balanceDue = Math.max(0, totalOwed - totalPaid - (d.scholarshipAmount || 0));
    return {
        summary: {
            playerName: d.playerName || '',
            teamName: d.teamName || '',
            season: d.season || '',
            balanceDue,
            financeId: docSnap.id,
        },
    };
});
//# sourceMappingURL=parentActions.js.map