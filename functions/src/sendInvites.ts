import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { sendParentInviteEmail, sendBatchInvoiceNotifications } from './emails';

const corsHandler = cors({ origin: true });

/**
 * Compute fee total from a player finance document.
 * Must match the formula in src/lib/api/finances.ts → computeFeeTotal.
 */
const computeFeeTotal = (data: {
  registrationFee?: number;
  uniformCost?: number;
  tournamentFees?: number;
  facilityFees?: number;
  equipmentFees?: number;
  otherFees?: number;
}): number =>
  (data.registrationFee || 0) +
  (data.uniformCost || 0) +
  (data.tournamentFees || 0) +
  (data.facilityFees || 0) +
  (data.equipmentFees || 0) +
  (data.otherFees || 0);

/**
 * HTTP function to send invite emails to pending parent users.
 * Creates Firebase Auth accounts and sends branded invite emails
 * with password reset links.
 *
 * Request body: { emails: string[] } or { all: true }
 */
export const sendParentInvites = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

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
      if (!userData || !(userData.roles?.some((r: string) => ['admin', 'master-admin'].includes(r)) || ['admin', 'master-admin'].includes(userData.role))) {
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
            roles: ['parent'],
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

          // Generate a custom invite token (never expires)
          const crypto = require('crypto');
          const inviteToken = crypto.randomUUID();

          // Store the invite token on the pending user doc
          await pendingQuery.docs[0].ref.update({
            inviteToken,
            updatedAt: admin.firestore.Timestamp.now(),
          });

          // Build the setup link (never expires)
          const resetLink = `https://nmwaves.com/setup-account?token=${inviteToken}&email=${encodeURIComponent(email)}`;

          // Resolve player names for the invite email
          const playerNames: string[] = [];
          const linkedPlayerIds = pendingData.linkedPlayerIds || [];
          for (const pid of linkedPlayerIds) {
            try {
              const playerDoc = await db.collection('players').doc(pid).get();
              if (playerDoc.exists) {
                const pd = playerDoc.data()!;
                playerNames.push(`${pd.firstName} ${pd.lastName}`);
              }
            } catch {
              // skip
            }
          }

          // Send branded invite email
          await sendParentInviteEmail({
            email,
            parentName: pendingData.displayName || '',
            playerNames,
            resetLink,
          });

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
});

/**
 * HTTP function to send invoice notification emails to parents.
 * Looks up player finance records and parent contact info, then
 * sends branded invoice emails with fee breakdowns and payment links.
 *
 * Request body:
 *   { teamId: string, dueDate?: string }   — send to all parents on a team
 *   { financeIds: string[], dueDate?: string } — send to specific players
 */
export const sendInvoiceEmails = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

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
      if (!userData || !(userData.roles?.some((r: string) => ['admin', 'master-admin'].includes(r)) || ['admin', 'master-admin'].includes(userData.role))) {
        res.status(403).send('Forbidden: Admin access required');
        return;
      }

      const { teamId, financeIds, dueDate } = req.body;

      // Fetch relevant playerFinances
      let financeDocs: admin.firestore.QueryDocumentSnapshot[] = [];

      if (teamId) {
        const snap = await db.collection('playerFinances').where('teamId', '==', teamId).get();
        financeDocs = snap.docs;
      } else if (Array.isArray(financeIds) && financeIds.length > 0) {
        // Firestore 'in' query max is 30
        for (let i = 0; i < financeIds.length; i += 30) {
          const batch = financeIds.slice(i, i + 30);
          const snap = await db.collection('playerFinances')
            .where(admin.firestore.FieldPath.documentId(), 'in', batch)
            .get();
          financeDocs.push(...snap.docs);
        }
      } else {
        res.status(400).send('Provide teamId or financeIds[]');
        return;
      }

      // For each finance, look up parent email from players collection
      const financeList: Array<any> = [];

      for (const fDoc of financeDocs) {
        const fData = fDoc.data();
        const totalOwed = computeFeeTotal(fData);
        const payments = fData.payments || [];
        const totalPaid = payments.reduce((s: number, p: any) => s + p.amount, 0);
        const balanceDue = totalOwed - totalPaid - (fData.scholarshipAmount || 0);

        // Skip paid-up players
        if (balanceDue <= 0) continue;

        // Lookup ALL parent/guardian emails from contacts
        const parentEmails: string[] = [];
        let parentName = '';

        if (fData.playerId) {
          const playerDoc = await db.collection('players').doc(fData.playerId).get();
          if (playerDoc.exists) {
            const pd = playerDoc.data()!;
            parentName = pd.parentName || '';

            // Collect all contact emails (parents, guardians, etc.)
            const contacts = pd.contacts || [];
            for (const c of contacts) {
              if (c.email && !parentEmails.includes(c.email)) {
                parentEmails.push(c.email);
                if (!parentName) parentName = c.name || '';
              }
            }

            // Fallback to legacy parentEmail field
            if (parentEmails.length === 0 && pd.parentEmail) {
              parentEmails.push(pd.parentEmail);
              parentName = pd.parentName || parentName;
            }
          }
        }

        if (parentEmails.length === 0) continue;

        // Send invoice to EACH parent/guardian contact
        for (const pEmail of parentEmails) {
          financeList.push({
            financeId: fDoc.id,
            playerName: fData.playerName || '',
            teamName: fData.teamName || '',
            season: fData.season || '',
            parentEmail: pEmail,
            parentName,
            totalOwed,
            totalPaid,
            balanceDue,
            feeBreakdown: {
              registrationFee: fData.registrationFee || 0,
              uniformCost: fData.uniformCost || 0,
              tournamentFees: fData.tournamentFees || 0,
              facilityFees: fData.facilityFees || 0,
              equipmentFees: fData.equipmentFees || 0,
              otherFees: fData.otherFees || 0,
            },
            scholarshipAmount: fData.scholarshipAmount || 0,
          });
        }
      }

      const result = await sendBatchInvoiceNotifications({
        finances: financeList,
        dueDate,
      });

      res.json({
        success: true,
        ...result,
        totalFinances: financeDocs.length,
        eligibleForEmail: financeList.length,
      });
    } catch (error: any) {
      console.error('Invoice email error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});
