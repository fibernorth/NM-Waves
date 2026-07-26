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
exports.adminSetUserDisabled = exports.adminUpdateUserAuth = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const getDb = () => admin.firestore();
const rolesOf = (data) => (data === null || data === void 0 ? void 0 : data.roles) || ((data === null || data === void 0 ? void 0 : data.role) ? [data.role] : []);
const isAdminRoles = (roles) => roles.includes('admin') || roles.includes('master-admin');
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
exports.adminUpdateUserAuth = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const callerSnap = await getDb().collection('users').doc(context.auth.uid).get();
    const callerRoles = rolesOf(callerSnap.data());
    if (!isAdminRoles(callerRoles)) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only');
    }
    const callerIsMaster = callerRoles.includes('master-admin');
    const uid = String((data === null || data === void 0 ? void 0 : data.uid) || '').trim();
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'uid is required');
    }
    const email = (data === null || data === void 0 ? void 0 : data.email) != null ? String(data.email).trim().toLowerCase() : undefined;
    const password = (data === null || data === void 0 ? void 0 : data.password) != null ? String(data.password) : undefined;
    if (email === undefined && (password === undefined || password === '')) {
        throw new functions.https.HttpsError('invalid-argument', 'Nothing to update');
    }
    // Load the target so we can enforce the password guardrail.
    const targetDoc = await getDb().collection('users').doc(uid).get();
    if (!targetDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const targetRoles = rolesOf(targetDoc.data());
    const authUpdate = {};
    if (email !== undefined) {
        // Same guardrail as password: an admin cannot change the login email of
        // another admin/master-admin (which, via the reset flow, would let them
        // seize that account). Only a master-admin may touch a privileged
        // account's email.
        if (isAdminRoles(targetRoles) && !callerIsMaster) {
            throw new functions.https.HttpsError('permission-denied', "Only a master admin can change an admin account's login email.");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new functions.https.HttpsError('invalid-argument', 'Enter a valid email address');
        }
        authUpdate.email = email;
    }
    if (password !== undefined && password !== '') {
        if (isAdminRoles(targetRoles)) {
            throw new functions.https.HttpsError('permission-denied', "You can't reset an admin's password here — they reset their own from the sign-in page.");
        }
        if (password.length < 6) {
            throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
        }
        authUpdate.password = password;
    }
    try {
        await admin.auth().updateUser(uid, authUpdate);
    }
    catch (err) {
        const code = (err === null || err === void 0 ? void 0 : err.code) || '';
        if (code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'That email is already in use by another account');
        }
        if (code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'No auth account exists for this user');
        }
        throw new functions.https.HttpsError('internal', (err === null || err === void 0 ? void 0 : err.message) || 'Failed to update the account');
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
});
/**
 * Admin-only: enable/disable a user's ACCOUNT. Disabling here disables the
 * Firebase Auth record (so the user can no longer sign in at all) and mirrors
 * the flag onto the Firestore doc. Previously "delete" only flagged the doc,
 * so a "deleted" user could still log in with full access.
 *
 * Same guardrail as email/password: an admin cannot disable an admin/
 * master-admin (only a master-admin can), and no one can disable themselves.
 */
exports.adminSetUserDisabled = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const callerSnap = await getDb().collection('users').doc(context.auth.uid).get();
    const callerRoles = rolesOf(callerSnap.data());
    if (!isAdminRoles(callerRoles)) {
        throw new functions.https.HttpsError('permission-denied', 'Admins only');
    }
    const callerIsMaster = callerRoles.includes('master-admin');
    const uid = String((data === null || data === void 0 ? void 0 : data.uid) || '').trim();
    const disabled = (data === null || data === void 0 ? void 0 : data.disabled) === true;
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
        throw new functions.https.HttpsError('permission-denied', "Only a master admin can disable an admin account.");
    }
    try {
        await admin.auth().updateUser(uid, { disabled });
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.code) !== 'auth/user-not-found') {
            throw new functions.https.HttpsError('internal', (err === null || err === void 0 ? void 0 : err.message) || 'Failed to update the account');
        }
    }
    await getDb().collection('users').doc(uid).update({
        disabled,
        disabledAt: disabled ? admin.firestore.Timestamp.now() : admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.Timestamp.now(),
    });
    return { success: true, disabled };
});
//# sourceMappingURL=adminUsers.js.map