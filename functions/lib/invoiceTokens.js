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
exports.generateInvoiceToken = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const db = admin.firestore();
/**
 * Generates a unique invoice token for QR code payments.
 * Admin only. Creates a token doc in the invoiceTokens collection.
 */
exports.generateInvoiceToken = functions.https.onCall(async (data, context) => {
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
    const financeData = financeDoc.data();
    // Calculate balance due
    const totalOwed = (financeData.registrationFee || 0) +
        (financeData.uniformCost || 0) +
        (financeData.tournamentFees || 0) +
        (financeData.facilityFees || 0) +
        (financeData.equipmentFees || 0) +
        (financeData.otherFees || 0);
    const totalPaid = (financeData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
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
});
//# sourceMappingURL=invoiceTokens.js.map