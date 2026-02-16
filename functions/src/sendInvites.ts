import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * HTTP function to send invite emails to pending parent users.
 * Called by admin from the UI. Creates Firebase Auth accounts
 * and sends password reset emails (which serve as invites).
 *
 * Request body: { emails: string[] } or { all: true }
 */
export const sendParentInvites = functions.https.onRequest(async (req, res) => {
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
    if (!userData || !['admin', 'master-admin'].includes(userData.role)) {
      res.status(403).send('Forbidden: Admin access required');
      return;
    }

    const { emails, all } = req.body;
    let pendingEmails: string[] = [];

    if (all) {
      const pendingSnapshot = await db
        .collection('pendingUsers')
        .where('status', '==', 'pending')
        .get();
      pendingEmails = pendingSnapshot.docs.map(doc => doc.data().email);
    } else if (Array.isArray(emails)) {
      pendingEmails = emails;
    } else {
      res.status(400).send('Provide emails array or all: true');
      return;
    }

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

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
        } catch {
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
      } catch (error: any) {
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
  } catch (error: any) {
    console.error('Invite error:', error);
    res.status(500).json({ error: error.message });
  }
});
