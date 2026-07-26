import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const getDb = () => admin.firestore();

const rolesOf = (data: any): string[] =>
  data?.roles || (data?.role ? [data.role] : []);

const isAdminRoles = (roles: string[]): boolean =>
  roles.includes('admin') || roles.includes('master-admin');

/**
 * Admin-only: change a user's LOGIN email and/or set a new password. These are
 * Firebase Auth operations (not just the Firestore mirror), so they must run
 * through the Admin SDK here rather than a client write.
 *
 * Guardrails:
 *  - Caller must be an admin / master-admin.
 *  - Password changes are limited to non-admin accounts (i.e. parents and the
 *    like). Resetting another admin's or a master-admin's password is refused,
 *    so an admin can't seize a higher/peer account — those reset their own
 *    password through the normal flow.
 *  - Email changes keep the Firestore user doc's `email` field in sync.
 */
export const adminUpdateUserAuth = functions.https.onCall(
  async (
    data: { uid: string; email?: string; password?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const callerSnap = await getDb().collection('users').doc(context.auth.uid).get();
    const callerRoles = rolesOf(callerSnap.data());
    if (!isAdminRoles(callerRoles)) {
      throw new functions.https.HttpsError('permission-denied', 'Admins only');
    }
    const callerIsMaster = callerRoles.includes('master-admin');

    const uid = String(data?.uid || '').trim();
    if (!uid) {
      throw new functions.https.HttpsError('invalid-argument', 'uid is required');
    }
    const email = data?.email != null ? String(data.email).trim().toLowerCase() : undefined;
    const password = data?.password != null ? String(data.password) : undefined;

    if (email === undefined && (password === undefined || password === '')) {
      throw new functions.https.HttpsError('invalid-argument', 'Nothing to update');
    }

    // Load the target so we can enforce the password guardrail.
    const targetDoc = await getDb().collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const targetRoles = rolesOf(targetDoc.data());

    const authUpdate: admin.auth.UpdateRequest = {};

    if (email !== undefined) {
      // Same guardrail as password: an admin cannot change the login email of
      // another admin/master-admin (which, via the reset flow, would let them
      // seize that account). Only a master-admin may touch a privileged
      // account's email.
      if (isAdminRoles(targetRoles) && !callerIsMaster) {
        throw new functions.https.HttpsError(
          'permission-denied',
          "Only a master admin can change an admin account's login email."
        );
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Enter a valid email address');
      }
      authUpdate.email = email;
    }

    if (password !== undefined && password !== '') {
      if (isAdminRoles(targetRoles)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          "You can't reset an admin's password here — they reset their own from the sign-in page."
        );
      }
      if (password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
      }
      authUpdate.password = password;
    }

    try {
      await admin.auth().updateUser(uid, authUpdate);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'That email is already in use by another account');
      }
      if (code === 'auth/user-not-found') {
        throw new functions.https.HttpsError('not-found', 'No auth account exists for this user');
      }
      throw new functions.https.HttpsError('internal', err?.message || 'Failed to update the account');
    }

    // Keep the Firestore mirror in sync when the email changed.
    if (email !== undefined) {
      await getDb().collection('users').doc(uid).update({
        email,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    return {
      success: true,
      emailChanged: email !== undefined,
      passwordChanged: password !== undefined && password !== '',
    };
  }
);

/**
 * Admin-only: enable/disable a user's ACCOUNT. Disabling here disables the
 * Firebase Auth record (so the user can no longer sign in at all) and mirrors
 * the flag onto the Firestore doc. Previously "delete" only flagged the doc,
 * so a "deleted" user could still log in with full access.
 *
 * Same guardrail as email/password: an admin cannot disable an admin/
 * master-admin (only a master-admin can), and no one can disable themselves.
 */
export const adminSetUserDisabled = functions.https.onCall(
  async (data: { uid: string; disabled: boolean }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const callerSnap = await getDb().collection('users').doc(context.auth.uid).get();
    const callerRoles = rolesOf(callerSnap.data());
    if (!isAdminRoles(callerRoles)) {
      throw new functions.https.HttpsError('permission-denied', 'Admins only');
    }
    const callerIsMaster = callerRoles.includes('master-admin');

    const uid = String(data?.uid || '').trim();
    const disabled = data?.disabled === true;
    if (!uid) {
      throw new functions.https.HttpsError('invalid-argument', 'uid is required');
    }
    if (uid === context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'You cannot disable your own account');
    }

    const targetDoc = await getDb().collection('users').doc(uid).get();
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    if (isAdminRoles(rolesOf(targetDoc.data())) && !callerIsMaster) {
      throw new functions.https.HttpsError(
        'permission-denied',
        "Only a master admin can disable an admin account."
      );
    }

    try {
      await admin.auth().updateUser(uid, { disabled });
    } catch (err: any) {
      if (err?.code !== 'auth/user-not-found') {
        throw new functions.https.HttpsError('internal', err?.message || 'Failed to update the account');
      }
    }

    await getDb().collection('users').doc(uid).update({
      disabled,
      disabledAt: disabled ? admin.firestore.Timestamp.now() : admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return { success: true, disabled };
  }
);
