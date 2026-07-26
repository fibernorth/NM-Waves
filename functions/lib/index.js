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
exports.sendTryoutOffer = exports.submitEvalScoreByToken = exports.getEvalEventByToken = exports.emailOutstandingInvoices = exports.emailPlayerBilling = exports.adminUpdateUserAuth = exports.emailAllParents = exports.syncLinkedParentTeams = exports.linkChild = exports.searchLinkablePlayers = exports.getPlayerFinanceSummary = exports.updateLinkedPlayerContact = exports.getInvoiceByToken = exports.getPublicRoster = exports.sendCustomPasswordReset = exports.setAccountPassword = exports.listDrivePhotos = exports.batchAnalyzeMedia = exports.analyzeMedia = exports.moderateMedia = exports.batchGenerateInvoices = exports.generateInvoiceToken = exports.stripeWebhook = exports.createCheckoutSession = exports.sendInvoiceEmails = exports.sendParentInvites = exports.cleanupExpiredTokens = exports.onUserDisabled = exports.scrapeGameChanger = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const sendInvites_1 = require("./sendInvites");
Object.defineProperty(exports, "sendParentInvites", { enumerable: true, get: function () { return sendInvites_1.sendParentInvites; } });
Object.defineProperty(exports, "sendInvoiceEmails", { enumerable: true, get: function () { return sendInvites_1.sendInvoiceEmails; } });
const stripe_1 = require("./stripe");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return stripe_1.createCheckoutSession; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripe_1.stripeWebhook; } });
const invoiceTokens_1 = require("./invoiceTokens");
Object.defineProperty(exports, "generateInvoiceToken", { enumerable: true, get: function () { return invoiceTokens_1.generateInvoiceToken; } });
Object.defineProperty(exports, "batchGenerateInvoices", { enumerable: true, get: function () { return invoiceTokens_1.batchGenerateInvoices; } });
const moderation_1 = require("./moderation");
Object.defineProperty(exports, "moderateMedia", { enumerable: true, get: function () { return moderation_1.moderateMedia; } });
const analyzeMedia_1 = require("./analyzeMedia");
Object.defineProperty(exports, "analyzeMedia", { enumerable: true, get: function () { return analyzeMedia_1.analyzeMedia; } });
Object.defineProperty(exports, "batchAnalyzeMedia", { enumerable: true, get: function () { return analyzeMedia_1.batchAnalyzeMedia; } });
const googleDrive_1 = require("./googleDrive");
Object.defineProperty(exports, "listDrivePhotos", { enumerable: true, get: function () { return googleDrive_1.listDrivePhotos; } });
const accountSetup_1 = require("./accountSetup");
Object.defineProperty(exports, "setAccountPassword", { enumerable: true, get: function () { return accountSetup_1.setAccountPassword; } });
Object.defineProperty(exports, "sendCustomPasswordReset", { enumerable: true, get: function () { return accountSetup_1.sendCustomPasswordReset; } });
admin.initializeApp();
/**
 * Scheduled Cloud Function placeholder: GameChanger scraping is disabled.
 * The Puppeteer-based scraper cannot run on Cloud Functions (no browser binary,
 * insufficient memory). Stats are now imported via scripts/import-stats.cjs.
 * To re-enable, migrate to Cloud Run with a container that includes Chromium.
 */
exports.scrapeGameChanger = functions.pubsub
    .schedule('0 2 * * *')
    .timeZone('America/New_York')
    .onRun(async () => {
    console.log('GameChanger scraping is disabled — use scripts/import-stats.cjs or migrate to Cloud Run');
    return null;
});
/**
 * Firestore trigger: when a user document is marked as disabled,
 * disable their Firebase Auth account to prevent login.
 */
exports.onUserDisabled = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only act when disabled changes from false/undefined to true
    if (!before.disabled && after.disabled) {
        const uid = context.params.userId;
        try {
            await admin.auth().updateUser(uid, { disabled: true });
            console.log(`Disabled Auth account for user ${uid}`);
        }
        catch (error) {
            console.error(`Failed to disable Auth account for ${uid}:`, error);
        }
    }
});
/**
 * Scheduled cleanup: remove expired password reset tokens (older than 48 hours).
 * Runs daily at 3am EST.
 */
exports.cleanupExpiredTokens = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('America/New_York')
    .onRun(async () => {
    const db = admin.firestore();
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);
    const expired = await db.collection('passwordResets')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoff))
        .get();
    if (expired.empty) {
        console.log('No expired password reset tokens to clean up');
        return null;
    }
    const batch = db.batch();
    expired.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Cleaned up ${expired.size} expired password reset tokens`);
    return null;
});
var publicData_1 = require("./publicData");
Object.defineProperty(exports, "getPublicRoster", { enumerable: true, get: function () { return publicData_1.getPublicRoster; } });
Object.defineProperty(exports, "getInvoiceByToken", { enumerable: true, get: function () { return publicData_1.getInvoiceByToken; } });
var parentActions_1 = require("./parentActions");
Object.defineProperty(exports, "updateLinkedPlayerContact", { enumerable: true, get: function () { return parentActions_1.updateLinkedPlayerContact; } });
Object.defineProperty(exports, "getPlayerFinanceSummary", { enumerable: true, get: function () { return parentActions_1.getPlayerFinanceSummary; } });
Object.defineProperty(exports, "searchLinkablePlayers", { enumerable: true, get: function () { return parentActions_1.searchLinkablePlayers; } });
Object.defineProperty(exports, "linkChild", { enumerable: true, get: function () { return parentActions_1.linkChild; } });
Object.defineProperty(exports, "syncLinkedParentTeams", { enumerable: true, get: function () { return parentActions_1.syncLinkedParentTeams; } });
var emailBroadcast_1 = require("./emailBroadcast");
Object.defineProperty(exports, "emailAllParents", { enumerable: true, get: function () { return emailBroadcast_1.emailAllParents; } });
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "adminUpdateUserAuth", { enumerable: true, get: function () { return adminUsers_1.adminUpdateUserAuth; } });
var billingEmails_1 = require("./billingEmails");
Object.defineProperty(exports, "emailPlayerBilling", { enumerable: true, get: function () { return billingEmails_1.emailPlayerBilling; } });
Object.defineProperty(exports, "emailOutstandingInvoices", { enumerable: true, get: function () { return billingEmails_1.emailOutstandingInvoices; } });
var evalGuest_1 = require("./evalGuest");
Object.defineProperty(exports, "getEvalEventByToken", { enumerable: true, get: function () { return evalGuest_1.getEvalEventByToken; } });
Object.defineProperty(exports, "submitEvalScoreByToken", { enumerable: true, get: function () { return evalGuest_1.submitEvalScoreByToken; } });
var tryoutOffer_1 = require("./tryoutOffer");
Object.defineProperty(exports, "sendTryoutOffer", { enumerable: true, get: function () { return tryoutOffer_1.sendTryoutOffer; } });
//# sourceMappingURL=index.js.map