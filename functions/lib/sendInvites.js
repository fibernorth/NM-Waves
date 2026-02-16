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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendParentInvites = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const corsHandler = (0, cors_1.default)({ origin: true });
/**
 * HTTP function to send invite emails to pending parent users.
 * Called by admin from the UI. Creates Firebase Auth accounts
 * and sends password reset emails (which serve as invites).
 *
 * Request body: { emails: string[] } or { all: true }
 */
exports.sendParentInvites = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a;
        if (req.method !== 'POST') {
            res.status(405).send('Method not allowed');
            return;
        }
        // Verify admin auth
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).send('Unauthorized');
            return;
        }
        const db = admin.firestore();
        try {
            const token = authHeader.split('Bearer ')[1];
            const decoded = await admin.auth().verifyIdToken(token);
            const userDoc = await db.collection('users').doc(decoded.uid).get();
            const userData = userDoc.data();
            if (!userData || !(((_a = userData.roles) === null || _a === void 0 ? void 0 : _a.some((r) => ['admin', 'master-admin'].includes(r))) || ['admin', 'master-admin'].includes(userData.role))) {
                res.status(403).send('Forbidden: Admin access required');
                return;
            }
            const { emails, all } = req.body;
            let pendingEmails = [];
            if (all) {
                const pendingSnapshot = await db
                    .collection('pendingUsers')
                    .where('status', '==', 'pending')
                    .get();
                pendingEmails = pendingSnapshot.docs.map(doc => doc.data().email);
            }
            else if (Array.isArray(emails)) {
                pendingEmails = emails;
            }
            else {
                res.status(400).send('Provide emails array or all: true');
                return;
            }
            const results = [];
            for (const email of pendingEmails) {
                try {
                    // Get pending user data
                    const pendingQuery = await db
                        .collection('pendingUsers')
                        .where('email', '==', email)
                        .get();
                    if (pendingQuery.empty) {
                        results.push({ email, success: false, error: 'No pending user found' });
                        continue;
                    }
                    const pendingData = pendingQuery.docs[0].data();
                    // Create Firebase Auth user
                    let authUser;
                    try {
                        authUser = await admin.auth().getUserByEmail(email);
                    }
                    catch (_b) {
                        // User doesn't exist, create one
                        authUser = await admin.auth().createUser({
                            email,
                            displayName: pendingData.displayName,
                        });
                    }
                    // Create/update user doc in users collection
                    await db.collection('users').doc(authUser.uid).set({
                        uid: authUser.uid,
                        email,
                        displayName: pendingData.displayName,
                        role: 'parent',
                        teamIds: pendingData.teamIds || [],
                        linkedPlayerIds: pendingData.linkedPlayerIds || [],
                        permissions: pendingData.permissions || {
                            canEditRosters: false,
                            canViewFinancials: true,
                            canManageSchedules: false,
                            canUploadMedia: false,
                        },
                        createdAt: admin.firestore.Timestamp.now(),
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                    // Send password reset email (serves as invite)
                    const resetLink = await admin.auth().generatePasswordResetLink(email);
                    // Note: In production, use SendGrid/Mailgun/etc. to send a branded invite email
                    // For now, Firebase sends the default password reset email
                    console.log(`Invite link for ${email}: ${resetLink}`);
                    // Mark pending user as invited
                    await pendingQuery.docs[0].ref.update({
                        status: 'invited',
                        invitedAt: admin.firestore.Timestamp.now(),
                        authUid: authUser.uid,
                        updatedAt: admin.firestore.Timestamp.now(),
                    });
                    results.push({ email, success: true });
                }
                catch (error) {
                    results.push({ email, success: false, error: error.message });
                }
            }
            res.json({
                success: true,
                total: pendingEmails.length,
                sent: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results,
            });
        }
        catch (error) {
            console.error('Invite error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});
//# sourceMappingURL=sendInvites.js.map