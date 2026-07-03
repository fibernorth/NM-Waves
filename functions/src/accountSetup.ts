import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import cors from 'cors';
import { sendPasswordResetCustomEmail } from './emails';

const corsHandler = cors({ origin: true });
const SITE_URL = process.env.SITE_URL || 'https://nmwaves.com';

/**
 * HTTP function to set a user's password using a custom invite or reset token.
 *
 * For invite tokens: no expiration — stored on pendingUsers doc
 * For reset tokens: 48-hour expiration — stored in passwordResets collection
 *
 * Request body: { token: string, email: string, password: string, type: 'invite' | 'reset' }
 */
export const setAccountPassword = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const { token, email, password, type } = req.body;

    if (!token || !email || !password || !type) {
      res.status(400).json({ error: 'Missing required fields: token, email, password, type' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const db = admin.firestore();

    try {
      // Rate limiting: max 5 password set attempts per email per hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      const attemptsKey = `passwordAttempts_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const attemptRef = db.collection('rateLimits').doc(attemptsKey);
      const attemptDoc = await attemptRef.get();
      if (attemptDoc.exists) {
        const data = attemptDoc.data()!;
        const lastAttempt = data.lastAttempt?.toDate();
        if (lastAttempt && lastAttempt > oneHourAgo && (data.count || 0) >= 5) {
          res.status(429).json({ error: 'Too many attempts. Please try again later.' });
          return;
        }
        // Reset counter if outside the window
        if (!lastAttempt || lastAttempt <= oneHourAgo) {
          await attemptRef.set({ count: 1, lastAttempt: admin.firestore.Timestamp.now() });
        } else {
          await attemptRef.update({
            count: admin.firestore.FieldValue.increment(1),
            lastAttempt: admin.firestore.Timestamp.now(),
          });
        }
      } else {
        await attemptRef.set({ count: 1, lastAttempt: admin.firestore.Timestamp.now() });
      }

      if (type === 'invite') {
        // Look up invite token from pendingUsers collection
        const pendingQuery = await db
          .collection('pendingUsers')
          .where('email', '==', email)
          .where('inviteToken', '==', token)
          .get();

        if (pendingQuery.empty) {
          res.status(400).json({ error: 'Invalid or expired invite link. Please contact your administrator.' });
          return;
        }

        const pendingDoc = pendingQuery.docs[0];
        const pendingData = pendingDoc.data();

        // Token is valid (invite tokens never expire)
        // Find or verify the Firebase Auth user
        let authUser;
        try {
          authUser = await admin.auth().getUserByEmail(email);
        } catch {
          res.status(400).json({ error: 'Account not found. Please contact your administrator.' });
          return;
        }

        // Set the password
        await admin.auth().updateUser(authUser.uid, { password });

        // Mark invite as completed
        await pendingDoc.ref.update({
          status: 'activated',
          activatedAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

        // Set onboardingComplete = false so they see the welcome dialog
        await db.collection('users').doc(authUser.uid).update({
          onboardingComplete: false,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        res.json({ success: true, message: 'Password set successfully. You can now log in.' });

      } else if (type === 'reset') {
        // Look up reset token from passwordResets collection
        const resetQuery = await db
          .collection('passwordResets')
          .where('email', '==', email)
          .where('token', '==', token)
          .where('used', '==', false)
          .get();

        if (resetQuery.empty) {
          res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
          return;
        }

        const resetDoc = resetQuery.docs[0];
        const resetData = resetDoc.data();

        // Check 48-hour expiration
        const expiresAt = resetData.expiresAt?.toDate();
        if (expiresAt && expiresAt < new Date()) {
          await resetDoc.ref.update({ used: true });
          res.status(400).json({ error: 'This reset link has expired. Please request a new one from the login page.' });
          return;
        }

        // Find Firebase Auth user
        let authUser;
        try {
          authUser = await admin.auth().getUserByEmail(email);
        } catch {
          res.status(400).json({ error: 'Account not found.' });
          return;
        }

        // Set the password
        await admin.auth().updateUser(authUser.uid, { password });

        // Mark token as used
        await resetDoc.ref.update({
          used: true,
          usedAt: admin.firestore.Timestamp.now(),
        });

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });

      } else {
        res.status(400).json({ error: 'Invalid type. Must be "invite" or "reset".' });
      }
    } catch (error: any) {
      console.error('setAccountPassword error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * HTTP function to send a custom password reset email with a 48-hour token.
 * Can be called by admins or by the login page (unauthenticated, for self-service).
 *
 * Request body: { email: string }
 */
export const sendCustomPasswordReset = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const db = admin.firestore();

    try {
      // Rate limiting: max 3 reset requests per email per hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      const recentResets = await db.collection('passwordResets')
        .where('email', '==', email)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneHourAgo))
        .get();
      if (recentResets.size >= 3) {
        // Return success message to avoid revealing rate limit as an enumeration signal
        res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
        return;
      }

      // Verify the user exists in Firebase Auth
      try {
        await admin.auth().getUserByEmail(email);
      } catch {
        // Don't reveal if user exists or not for security
        res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
        return;
      }

      // Generate a random token
      const token = crypto.randomUUID();

      // Store with 48-hour expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await db.collection('passwordResets').add({
        email,
        token,
        used: false,
        createdAt: admin.firestore.Timestamp.now(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });

      // Send email with custom reset link
      const resetLink = `${SITE_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      await sendPasswordResetCustomEmail({
        email,
        resetLink,
      });

      res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (error: any) {
      console.error('sendCustomPasswordReset error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});
