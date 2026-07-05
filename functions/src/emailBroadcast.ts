import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendBroadcastEmail } from './emails';

const getDb = () => admin.firestore();

/**
 * Admin-only broadcast: email every active player's parent/guardian contacts.
 * Gathers unique emails from active players' contacts (and the legacy
 * parentEmail field) and sends one branded message via the club's Gmail.
 */
export const emailAllParents = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
  const udata = userDoc.data() || {};
  const roles: string[] = udata.roles || (udata.role ? [udata.role] : []);
  if (!roles.includes('admin') && !roles.includes('master-admin')) {
    throw new functions.https.HttpsError('permission-denied', 'Admins only');
  }

  const subject = String(data?.subject || '').trim();
  const message = String(data?.message || '').trim();
  if (!subject || !message) {
    throw new functions.https.HttpsError('invalid-argument', 'Subject and message are required');
  }

  // Collect unique parent/guardian emails from active players.
  const snap = await getDb().collection('players').where('active', '==', true).get();
  const emails = new Set<string>();
  for (const doc of snap.docs) {
    const p = doc.data();
    for (const c of p.contacts || []) {
      if (c && c.email) emails.add(String(c.email).trim().toLowerCase());
    }
    if (p.parentEmail) emails.add(String(p.parentEmail).trim().toLowerCase());
  }
  const recipients = [...emails].filter((e) => e.includes('@'));
  if (recipients.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'No parent emails found on active players');
  }

  const result = await sendBroadcastEmail(recipients, subject, message);
  return { recipientCount: recipients.length, ...result };
});
