import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendTryoutOfferEmail } from './emails';

const getDb = () => admin.firestore();

/**
 * Coach/admin action: email a tryout applicant's family a branded offer
 * ("your player has been offered a spot") and mark the applicant invited.
 * Sending and the status flip happen together so "invited" always means
 * the family was actually notified.
 */
export const sendTryoutOffer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
  const udata = userDoc.data() || {};
  const roles: string[] = udata.roles || (udata.role ? [udata.role] : []);
  if (!roles.includes('admin') && !roles.includes('master-admin') && !roles.includes('coach')) {
    throw new functions.https.HttpsError('permission-denied', 'Coaches and admins only');
  }

  const applicantId = String(data?.applicantId || '').trim();
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
    throw new functions.https.HttpsError(
      'failed-precondition',
      'This applicant has no email address on file'
    );
  }

  const playerName = [a.playerFirstName, a.playerLastName].filter(Boolean).join(' ').trim() || 'Your player';

  await sendTryoutOfferEmail({
    email,
    parentName: String(a.parentName || ''),
    playerName,
    ageGroup: String(a.ageGroup || ''),
    sessionLabel: a.sessionLabel ? String(a.sessionLabel) : undefined,
  });

  await applicantRef.update({ status: 'invited' });

  return { sent: true, email };
});
