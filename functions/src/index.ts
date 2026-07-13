import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendParentInvites, sendInvoiceEmails } from './sendInvites';
import { createCheckoutSession, stripeWebhook } from './stripe';
import { generateInvoiceToken, batchGenerateInvoices } from './invoiceTokens';
import { moderateMedia } from './moderation';
import { analyzeMedia, batchAnalyzeMedia } from './analyzeMedia';
import { listDrivePhotos } from './googleDrive';
import { setAccountPassword, sendCustomPasswordReset } from './accountSetup';

admin.initializeApp();

/**
 * Scheduled Cloud Function placeholder: GameChanger scraping is disabled.
 * The Puppeteer-based scraper cannot run on Cloud Functions (no browser binary,
 * insufficient memory). Stats are now imported via scripts/import-stats.cjs.
 * To re-enable, migrate to Cloud Run with a container that includes Chromium.
 */
export const scrapeGameChanger = functions.pubsub
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
export const onUserDisabled = functions.firestore
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
      } catch (error) {
        console.error(`Failed to disable Auth account for ${uid}:`, error);
      }
    }
  });

/**
 * Scheduled cleanup: remove expired password reset tokens (older than 48 hours).
 * Runs daily at 3am EST.
 */
export const cleanupExpiredTokens = functions.pubsub
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

export { sendParentInvites, sendInvoiceEmails };
export { createCheckoutSession, stripeWebhook, generateInvoiceToken, batchGenerateInvoices };
export { moderateMedia, analyzeMedia, batchAnalyzeMedia, listDrivePhotos };
export { setAccountPassword, sendCustomPasswordReset };
export { getPublicRoster, getInvoiceByToken } from './publicData';
export {
  updateLinkedPlayerContact,
  getPlayerFinanceSummary,
  searchLinkablePlayers,
  linkChild,
} from './parentActions';
export { emailAllParents } from './emailBroadcast';
export { emailPlayerBilling, emailOutstandingInvoices } from './billingEmails';
export { getEvalEventByToken, submitEvalScoreByToken } from './evalGuest';
export { sendTryoutOffer } from './tryoutOffer';
