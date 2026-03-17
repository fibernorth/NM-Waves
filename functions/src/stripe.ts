import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { sendPaymentReceipt } from './emails';

const getDb = () => admin.firestore();

function getStripe(): Stripe {
  const secretKey = functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
}

interface CheckoutSessionParams {
  financeId?: string;
  playerId?: string;
  amount: number;
  sponsorId?: string;
  isAnonymous?: boolean;
  invoiceToken?: string;
  returnUrl: string;
  payerEmail?: string;
  payerName?: string;
  // Sponsor-only fields (when no financeId/playerId)
  sponsorBusinessName?: string;
  sponsorshipTarget?: string; // 'player' | 'team' | 'organization'
  sponsorNotes?: string;
}

/**
 * Creates a Stripe Checkout Session for a payment.
 * Called by the client to initiate Stripe Checkout.
 */
export const createCheckoutSession = functions.https.onCall(
  async (data: CheckoutSessionParams, context) => {
    const { financeId, playerId, amount, sponsorId, isAnonymous, invoiceToken, returnUrl, payerEmail, payerName, sponsorBusinessName, sponsorshipTarget, sponsorNotes } = data;

    const isSponsorPayment = !financeId && !playerId && !!sponsorBusinessName;

    if (!isSponsorPayment && (!financeId || !playerId)) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    if (!amount || !returnUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Validate returnUrl to prevent open redirect
    const allowedHosts = ['localhost', '127.0.0.1', 'nmwaves.org', 'www.nmwaves.org', 'nmwaves.com', 'www.nmwaves.com', 'tcw-website-builder.web.app', 'tcwavesballclub.com', 'www.tcwavesballclub.com'];
    try {
      const urlObj = new URL(returnUrl);
      if (!allowedHosts.some(h => urlObj.hostname === h || urlObj.hostname.endsWith(`.${h}`))) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid return URL');
      }
    } catch (e: any) {
      if (e instanceof functions.https.HttpsError) throw e;
      throw new functions.https.HttpsError('invalid-argument', 'Invalid return URL format');
    }

    if (amount < 0.5) {
      throw new functions.https.HttpsError('invalid-argument', 'Amount must be at least $0.50');
    }

    const stripe = getStripe();
    const metadata: Record<string, string> = {};
    let productName: string;
    let productDescription: string;

    if (isSponsorPayment) {
      // Sponsor payment — no finance record needed
      metadata.paymentType = 'sponsorship';
      metadata.sponsorBusinessName = sponsorBusinessName!;
      if (sponsorshipTarget) metadata.sponsorshipTarget = sponsorshipTarget;
      if (sponsorNotes) metadata.sponsorNotes = sponsorNotes;
      if (payerName) metadata.payerName = payerName;
      if (context.auth?.uid) metadata.userId = context.auth.uid;

      productName = `Sponsorship from ${sponsorBusinessName}`;
      const targetLabel = sponsorshipTarget === 'player' ? 'Player Sponsorship' :
        sponsorshipTarget === 'team' ? 'Team Sponsorship' : 'Organization Sponsorship';
      productDescription = targetLabel + (sponsorNotes ? ` — ${sponsorNotes}` : '');
    } else {
      // Player payment — requires finance record
      const financeDoc = await getDb().collection('playerFinances').doc(financeId!).get();
      if (!financeDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Finance record not found');
      }
      const financeData = financeDoc.data()!;

      metadata.financeId = financeId!;
      metadata.playerId = playerId!;
      metadata.playerName = financeData.playerName || '';
      metadata.teamName = financeData.teamName || '';
      metadata.season = financeData.season || '';
      if (sponsorId) metadata.sponsorId = sponsorId;
      if (isAnonymous) metadata.isAnonymous = 'true';
      if (invoiceToken) metadata.invoiceToken = invoiceToken;
      if (payerName) metadata.payerName = payerName;
      if (context.auth?.uid) metadata.userId = context.auth.uid;

      productName = `Payment for ${financeData.playerName}`;
      productDescription = `${financeData.teamName} - ${financeData.season}`;
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${returnUrl}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}/become-sponsor`,
    };

    // Override success/cancel URLs for player payments
    if (!isSponsorPayment) {
      sessionParams.success_url = `${returnUrl}/pay/success?session_id={CHECKOUT_SESSION_ID}`;
      sessionParams.cancel_url = `${returnUrl}/pay/cancel`;
    }

    if (payerEmail) {
      sessionParams.customer_email = payerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      sessionId: session.id,
      url: session.url,
    };
  }
);

/**
 * Stripe webhook handler for processing completed payments.
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const stripe = getStripe();
  const webhookSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event = undefined as any;

  // Try signature verification first (works with legacy webhook endpoints).
  // If it fails, fall back to parsing the body and verifying via the Stripe API
  // (works with new-style Event Destinations which use a different signing protocol).
  const sig = req.headers['stripe-signature'] as string;
  let verified = false;

  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      verified = true;
      console.log('Webhook verified via signature');
    } catch (err: any) {
      console.warn('Signature verification failed, will try API verification:', err.message);
    }
  }

  if (!verified) {
    // Parse the body and verify the event exists via Stripe API
    try {
      const body = JSON.parse(req.rawBody.toString('utf8'));
      if (!body.id || !body.type) {
        console.error('Invalid webhook payload: missing id or type');
        res.status(400).send('Invalid payload');
        return;
      }
      // Fetch the event directly from Stripe to confirm it's real
      event = await stripe.events.retrieve(body.id);
      console.log(`Webhook verified via API retrieval: ${event.id} (${event.type})`);
    } catch (err: any) {
      console.error('Webhook verification failed (both methods):', err.message);
      res.status(400).send('Webhook verification failed');
      return;
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    try {
      const amount = (session.amount_total || 0) / 100;
      const processingFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
      const paymentDate = admin.firestore.Timestamp.now();
      const paymentId = `stripe_${session.id}`;

      // === SPONSOR-ONLY PAYMENT (no financeId) ===
      if (metadata.paymentType === 'sponsorship') {
        const businessName = metadata.sponsorBusinessName || session.customer_details?.name || 'Unknown Sponsor';
        const target = metadata.sponsorshipTarget || 'organization';
        const notes = metadata.sponsorNotes || '';

        // 1. Create sponsor record
        const sponsorRef = await getDb().collection('sponsors').add({
          businessName,
          contactName: metadata.payerName || session.customer_details?.name || '',
          contactEmail: session.customer_details?.email || '',
          level: 'custom',
          sponsorshipType: target === 'player' ? 'player_sponsor' : target === 'team' ? 'team_sponsor' : 'general',
          season: new Date().getFullYear().toString(),
          displayOnPublicSite: false,
          amount,
          totalContributed: amount,
          contributions: [{
            id: paymentId,
            amount,
            date: paymentDate,
            method: 'stripe',
            reference: session.id,
            notes: notes || `Online sponsorship payment — ${target}`,
            recordedBy: 'stripe_webhook',
          }],
          sponsoredPlayers: [],
          totalSponsored: 0,
          createdAt: paymentDate,
        });

        // 2. Record income
        const sponsorIncomeRef = await getDb().collection('income').add({
          date: paymentDate,
          category: 'sponsorships',
          amount,
          source: businessName,
          description: `Sponsorship payment from ${businessName} (${target})`,
          payerName: metadata.payerName || session.customer_details?.name || '',
          paymentMethod: 'credit_card',
          referenceNumber: session.id,
          notes: notes ? `${notes} | Stripe Session: ${session.id}` : `Stripe Checkout Session: ${session.id}`,
          sourcePaymentId: paymentId,
          reconciled: false,
          recordedBy: 'stripe_webhook',
          createdAt: paymentDate,
          updatedAt: paymentDate,
        });

        // 3. Record processing fee
        const sponsorExpenseRef = await getDb().collection('expenses').add({
          date: paymentDate,
          category: 'processing_fees',
          amount: processingFee,
          vendor: 'Stripe',
          description: `CC processing fee for ${businessName} sponsorship ($${amount.toFixed(2)})`,
          paymentMethod: 'other',
          isPaid: true,
          paidDate: paymentDate,
          notes: `Stripe fee (2.9% + $0.30) on session ${session.id}`,
          recordedBy: 'stripe_webhook',
          createdAt: paymentDate,
          updatedAt: paymentDate,
        });

        // 4. Post GL entries for sponsor payment
        try {
          const glBatch = getDb().batch();
          glBatch.set(getDb().collection('generalLedger').doc(), {
            date: paymentDate, accountNumber: '1000', accountName: 'Cash - Checking',
            type: 'debit', amount, description: `Sponsorship from ${businessName}`,
            sourceType: 'income', sourceId: sponsorIncomeRef.id,
            createdBy: 'stripe_webhook', createdAt: paymentDate,
          });
          glBatch.set(getDb().collection('generalLedger').doc(), {
            date: paymentDate, accountNumber: '4100', accountName: 'Sponsorship Revenue',
            type: 'credit', amount, description: `Sponsorship from ${businessName}`,
            sourceType: 'income', sourceId: sponsorIncomeRef.id,
            createdBy: 'stripe_webhook', createdAt: paymentDate,
          });
          glBatch.set(getDb().collection('generalLedger').doc(), {
            date: paymentDate, accountNumber: '5850', accountName: 'Payment Processing Fees',
            type: 'debit', amount: processingFee, description: `Stripe fee on ${businessName} sponsorship`,
            sourceType: 'expense', sourceId: sponsorExpenseRef.id,
            createdBy: 'stripe_webhook', createdAt: paymentDate,
          });
          glBatch.set(getDb().collection('generalLedger').doc(), {
            date: paymentDate, accountNumber: '1000', accountName: 'Cash - Checking',
            type: 'credit', amount: processingFee, description: `Stripe fee on ${businessName} sponsorship`,
            sourceType: 'expense', sourceId: sponsorExpenseRef.id,
            createdBy: 'stripe_webhook', createdAt: paymentDate,
          });
          await glBatch.commit();
        } catch (glErr) {
          console.warn('GL posting failed for sponsor payment (non-fatal):', glErr);
        }

        console.log(`Sponsor payment processed: $${amount} from ${businessName} (${target}), sponsor doc: ${sponsorRef.id}`);
        res.status(200).json({ received: true });
        return;
      }

      // === PLAYER PAYMENT (has financeId) ===
      const {
        financeId,
        playerId,
        playerName,
        teamName,
        season,
        sponsorId,
        isAnonymous,
        invoiceToken,
        payerName,
        userId,
      } = metadata;

      if (!financeId || !playerId) {
        console.error('Missing financeId or playerId in session metadata');
        res.status(400).send('Missing metadata');
        return;
      }

      // 1. Record payment on player's finance record
      const financeRef = getDb().collection('playerFinances').doc(financeId);
      const financeDoc = await financeRef.get();
      let payments: any[] = [];

      if (financeDoc.exists) {
        const data = financeDoc.data()!;
        payments = data.payments || [];

        // Idempotency check
        const alreadyProcessed = payments.some(
          (p: any) => p.stripeSessionId === session.id
        );
        if (alreadyProcessed) {
          console.log(`Payment already processed for session ${session.id}, skipping`);
          res.status(200).json({ received: true });
          return;
        }

        const newPayment: any = {
          id: paymentId,
          amount,
          date: paymentDate,
          method: 'stripe',
          reference: session.id,
          notes: sponsorId
            ? `Stripe payment${isAnonymous === 'true' ? ' (anonymous sponsor)' : ''}`
            : 'Stripe payment',
          payerName: payerName || session.customer_details?.name || '',
          payerEmail: session.customer_details?.email || '',
          stripeSessionId: session.id,
          isAnonymous: isAnonymous === 'true',
          processingFee,
          recordedBy: 'stripe_webhook',
          recordedAt: paymentDate,
        };

        if (sponsorId) {
          newPayment.sponsorId = sponsorId;
          const sponsorDoc = await getDb().collection('sponsors').doc(sponsorId).get();
          if (sponsorDoc.exists) {
            newPayment.sponsorName = sponsorDoc.data()!.businessName;
          }
        }

        payments.push(newPayment);
        // Don't write yet — we'll add the incomeRecordId first, then write once
      }

      // 2. Record income entry (tagged with sourcePaymentId for reconciliation)
      const incomeCategory = sponsorId ? 'sponsorships' : 'player_payments';
      let incomeSource = payerName || session.customer_details?.name || 'Stripe Payment';
      if (sponsorId) {
        const sponsorDoc = await getDb().collection('sponsors').doc(sponsorId).get();
        if (sponsorDoc.exists) {
          incomeSource = sponsorDoc.data()!.businessName;
        }
      }

      const incomeRef = await getDb().collection('income').add({
        date: paymentDate,
        category: incomeCategory,
        amount,
        source: incomeSource,
        description: `Stripe payment for ${playerName || 'player'}`,
        payerName: payerName || session.customer_details?.name || '',
        paymentMethod: 'credit_card',
        referenceNumber: session.id,
        playerId,
        teamId: financeDoc.exists ? financeDoc.data()!.teamId || '' : '',
        season: season || '',
        notes: `Stripe Checkout Session: ${session.id}`,
        sourcePaymentId: paymentId,
        sourceFinanceId: financeId,
        reconciled: false,
        recordedBy: 'stripe_webhook',
        createdAt: paymentDate,
        updatedAt: paymentDate,
      });

      // Store incomeRecordId on the payment and write everything in one update
      if (financeDoc.exists) {
        const finalPayments = payments.map((p: any) =>
          p.id === paymentId ? { ...p, incomeRecordId: incomeRef.id } : p
        );
        await financeRef.update({ payments: finalPayments, updatedAt: paymentDate });
      }

      // 2b. Record processing fee
      const expenseRef = await getDb().collection('expenses').add({
        date: paymentDate,
        category: 'processing_fees',
        amount: processingFee,
        vendor: 'Stripe',
        description: `CC processing fee for ${playerName || 'player'} payment ($${amount.toFixed(2)})`,
        paymentMethod: 'other',
        season: season || '',
        isPaid: true,
        paidDate: paymentDate,
        notes: `Stripe fee (2.9% + $0.30) on session ${session.id}`,
        recordedBy: 'stripe_webhook',
        createdAt: paymentDate,
        updatedAt: paymentDate,
      });

      // 2c. Post GL entries (double-entry: debit Cash, credit Revenue)
      const revenueAccount = incomeCategory === 'sponsorships' ? '4100' : '4000';
      try {
        const glBatch = getDb().batch();
        // Income GL entries
        const glDebitRef = getDb().collection('generalLedger').doc();
        glBatch.set(glDebitRef, {
          date: paymentDate,
          accountNumber: '1000',
          accountName: 'Cash - Checking',
          type: 'debit',
          amount,
          description: `Stripe payment for ${playerName || 'player'}`,
          sourceType: 'income',
          sourceId: incomeRef.id,
          createdBy: 'stripe_webhook',
          createdAt: paymentDate,
        });
        const glCreditRef = getDb().collection('generalLedger').doc();
        glBatch.set(glCreditRef, {
          date: paymentDate,
          accountNumber: revenueAccount,
          accountName: revenueAccount === '4100' ? 'Sponsorship Revenue' : 'Player Payment Revenue',
          type: 'credit',
          amount,
          description: `Stripe payment for ${playerName || 'player'}`,
          sourceType: 'income',
          sourceId: incomeRef.id,
          createdBy: 'stripe_webhook',
          createdAt: paymentDate,
        });
        // Processing fee GL entries (debit Processing Fees, credit Cash)
        const glFeeDebitRef = getDb().collection('generalLedger').doc();
        glBatch.set(glFeeDebitRef, {
          date: paymentDate,
          accountNumber: '5850',
          accountName: 'Payment Processing Fees',
          type: 'debit',
          amount: processingFee,
          description: `Stripe processing fee on $${amount.toFixed(2)} payment`,
          sourceType: 'expense',
          sourceId: expenseRef.id,
          createdBy: 'stripe_webhook',
          createdAt: paymentDate,
        });
        const glFeeCreditRef = getDb().collection('generalLedger').doc();
        glBatch.set(glFeeCreditRef, {
          date: paymentDate,
          accountNumber: '1000',
          accountName: 'Cash - Checking',
          type: 'credit',
          amount: processingFee,
          description: `Stripe processing fee on $${amount.toFixed(2)} payment`,
          sourceType: 'expense',
          sourceId: expenseRef.id,
          createdBy: 'stripe_webhook',
          createdAt: paymentDate,
        });
        await glBatch.commit();
      } catch (glErr) {
        console.warn('GL posting failed for Stripe payment (non-fatal):', glErr);
      }

      // 3. If sponsor: update sponsor record
      if (sponsorId) {
        const sponsorRef = getDb().collection('sponsors').doc(sponsorId);
        const sponsorDoc = await sponsorRef.get();
        if (sponsorDoc.exists) {
          const sponsorData = sponsorDoc.data()!;
          const sponsoredPlayers = sponsorData.sponsoredPlayers || [];
          sponsoredPlayers.push({
            playerId,
            playerName: playerName || '',
            amount,
            paymentId,
            date: paymentDate,
          });

          await sponsorRef.update({
            sponsoredPlayers,
            totalSponsored: (sponsorData.totalSponsored || 0) + amount,
          });
        }
      }

      // 4. Mark invoice token as used (if applicable)
      if (invoiceToken) {
        const tokenQuery = await getDb()
          .collection('invoiceTokens')
          .where('token', '==', invoiceToken)
          .limit(1)
          .get();

        if (!tokenQuery.empty) {
          const tokenUpdate: Record<string, any> = {
            used: true,
            usedAt: paymentDate,
            usedBy: session.customer_details?.email || 'stripe',
          };
          if (userId) {
            tokenUpdate.paidByUserId = userId;
          }
          await tokenQuery.docs[0].ref.update(tokenUpdate);
        }
      }

      // 5. Send payment receipt email
      const recipientEmail = session.customer_details?.email || '';
      if (recipientEmail) {
        try {
          await sendPaymentReceipt({
            email: recipientEmail,
            amount,
            playerName: playerName || 'Player',
            teamName: teamName || '',
            season: season || '',
            date: new Date(),
            sponsorBusinessName: sponsorId ? (await getDb().collection('sponsors').doc(sponsorId).get()).data()?.businessName : undefined,
            stripeSessionId: session.id,
          });
        } catch (emailErr) {
          console.error('Failed to send receipt email:', emailErr);
          // Don't fail the webhook for email errors
        }
      }

      console.log(`Payment processed: ${amount} for player ${playerName} (finance: ${financeId})`);
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).send('Internal error processing payment');
      return;
    }
  }

  res.status(200).json({ received: true });
});
