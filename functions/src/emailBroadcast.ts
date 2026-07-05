import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendBroadcastEmail } from './emails';

const getDb = () => admin.firestore();

/**
 * Admin-only broadcast: email active players' parent/guardian contacts.
 * With no filters, targets ALL active players. Optional filters narrow the
 * audience: teamIds (players on any selected team) and/or playerIds
 * (individually selected players) — the audience is the union of both.
 * Gathers unique emails from players' contacts (and the legacy parentEmail
 * field) and sends one branded message via the club's Gmail.
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

  const emails = new Set<string>();

  if (data?.tryoutSignups) {
    // Audience: everyone who registered for tryouts (their contact email).
    const snap = await getDb().collection('tryout-applicants').get();
    for (const doc of snap.docs) {
      const a = doc.data();
      if (a.email) emails.add(String(a.email).trim().toLowerCase());
    }
  } else {
    const teamIds: string[] = Array.isArray(data?.teamIds) ? data.teamIds.map(String) : [];
    const playerIds: string[] = Array.isArray(data?.playerIds) ? data.playerIds.map(String) : [];
    const filtered = teamIds.length > 0 || playerIds.length > 0;
    const teamIdSet = new Set(teamIds);
    const playerIdSet = new Set(playerIds);

    // Note: read all players and skip quit — do not rely on an `active` flag.
    const snap = await getDb().collection('players').get();
    for (const doc of snap.docs) {
      const p = doc.data();
      if (p.status === 'quit') continue;
      if (filtered && !teamIdSet.has(p.teamId) && !playerIdSet.has(doc.id)) continue;
      for (const c of p.contacts || []) {
        if (c && c.email) emails.add(String(c.email).trim().toLowerCase());
      }
      if (p.parentEmail) emails.add(String(p.parentEmail).trim().toLowerCase());
    }
  }

  const recipients = [...emails].filter((e) => e.includes('@'));
  if (recipients.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'No email addresses found for the selected recipients');
  }

  const result = await sendBroadcastEmail(recipients, subject, message);
  return { recipientCount: recipients.length, ...result };
});
