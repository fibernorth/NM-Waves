import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { sendPaymentReceipt } from './emails';

const getDb = () => admin.firestore();
const SITE_URL = process.env.SITE_URL || functions.config().app?.site_url || 'https://nmwaves.com';

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
 * Records a webhook event whose processing failed, so a charged payment is
 * never silently lost. Writes a dead-letter document plus a high-severity admin
 * notification for manual reconciliation/replay.
 */
async function recordFailedWebhook(event: Stripe.Event, error: unknown): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  try {
    await getDb().collection('failedStripeWebhookEvents').doc(event.id).set({
      eventId: event.id,
      eventType: event.type,
      error: String(error),
      payload: JSON.stringify(event.data.object).slice(0, 8000),
      resolved: false,
      createdAt: now,
    });
    await getDb().collection('adminNotifications').add({
      type: 'webhook_processing_failure',
      severity: 'high',
      message: `Stripe webhook ${event.type} (${event.id}) failed to process. A payment may need manual reconciliation.`,
      eventId: event.id,
      createdAt: now,
      read: false,
    });
  } catch (writeErr) {
    console.error('Failed to record dead-letter webhook event:', writeErr);
  }
}

function getStripe(): Stripe {
  // STRIPE_SECRET_KEY is bound from Google Secret Manager via .runWith({ secrets })
  // on each Stripe function, so it arrives in process.env at runtime. The legacy
  // functions.config() fallback remains only for older deploys not yet migrated.
  const secretKey = process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key;
  if (!secretKey) {
    throw new Error('Stripe secret key not configured (set STRIPE_SECRET_KEY)');
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
export const createCheckoutSession = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(
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
    if (amount > 10000) {
      throw new functions.https.HttpsError('invalid-argument', 'Amount cannot exceed $10,000. Contact admin for larger payments.');
    }

    // Server-side invoice token validation (if provided)
    if (invoiceToken) {
      const tokenQuery = await getDb().collection('invoiceTokens')
        .where('token', '==', invoiceToken)
        .limit(1)
        .get();
      if (tokenQuery.empty) {
        throw new functions.https.HttpsError('not-found', 'Invalid invoice token');
      }
      const tokenData = tokenQuery.docs[0].data();
      if (tokenData.used) {
        throw new functions.https.HttpsError('failed-precondition', 'This invoice has already been paid');
      }
      if (tokenData.expiresAt?.toDate() < new Date()) {
        throw new functions.https.HttpsError('failed-precondition', 'This invoice has expired');
      }
      // The token must belong to the finance record being paid, otherwise a
      // token for player A could be consumed while crediting player B.
      if (tokenData.financeId && financeId && tokenData.financeId !== financeId) {
        throw new functions.https.HttpsError('failed-precondition', 'Invoice token does not match this account');
      }
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
export const stripeWebhook = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] })
  .https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || functions.config().stripe?.webhook_secret;

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
      // Fetch the event directly from Stripe to confirm it's real. This
      // authenticates the event (an attacker can't forge Stripe's own API
      // response), and idempotency guards below protect against replay of a
      // real event id — but it does mean signature verification is degraded.
      event = await stripe.events.retrieve(body.id);
      console.log(`Webhook verified via API retrieval: ${event.id} (${event.type})`);
      // Surface the degraded state so the signing secret gets fixed.
      try {
        await getDb().collection('adminNotifications').add({
          type: 'webhook_signature_degraded',
          severity: 'medium',
          message: `A Stripe webhook (${event.type}) was accepted via API re-fetch because signature verification failed. Check that STRIPE_WEBHOOK_SECRET matches this endpoint's signing secret.`,
          read: false,
          createdAt: admin.firestore.Timestamp.now(),
        });
      } catch (_) { /* notification is best-effort */ }
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
      // Default to the standard-pricing estimate, then replace with the ACTUAL
      // fee Stripe deducted (read from the charge's balance transaction) so the
      // books match Stripe's real deposit exactly — card type, international
      // surcharges, etc. all get captured rather than assumed.
      let processingFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
      try {
        if (session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(String(session.payment_intent), {
            expand: ['latest_charge.balance_transaction'],
          });
          const charge = pi.latest_charge;
          const bt =
            charge && typeof charge !== 'string' ? (charge.balance_transaction as any) : null;
          if (bt && typeof bt !== 'string' && typeof bt.fee === 'number') {
            processingFee = bt.fee / 100;
          }
        }
      } catch (feeErr: any) {
        console.error('Could not read actual Stripe fee, using estimate:', feeErr?.message);
      }
      const paymentDate = admin.firestore.Timestamp.now();
      const paymentId = `stripe_${session.id}`;

      // === SPONSOR-ONLY PAYMENT (no financeId) ===
      if (metadata.paymentType === 'sponsorship') {
        const businessName = metadata.sponsorBusinessName || session.customer_details?.name || 'Unknown Sponsor';
        const target = metadata.sponsorshipTarget || 'organization';
        const notes = metadata.sponsorNotes || '';

        // Idempotency check: see if this session was already processed
        const existingSponsorIncome = await getDb().collection('income')
          .where('referenceNumber', '==', session.id)
          .where('category', '==', 'sponsorships')
          .limit(1)
          .get();
        if (!existingSponsorIncome.empty) {
          console.log(`Sponsor payment already processed for session ${session.id}, skipping`);
          res.status(200).json({ received: true });
          return;
        }

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
          notes: `Stripe processing fee (actual) on session ${session.id}`,
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
          console.error('GL posting failed for sponsor payment:', glErr);
          // Write admin notification so failed GL postings are visible
          await getDb().collection('adminNotifications').add({
            type: 'gl_posting_failure',
            severity: 'high',
            message: `GL posting failed for sponsor payment from ${businessName} ($${amount.toFixed(2)}). Session: ${session.id}`,
            sourceType: 'income',
            sourceId: sponsorIncomeRef.id,
            error: String(glErr),
            createdAt: paymentDate,
            read: false,
          });
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
        console.error('Missing financeId or playerId in session metadata — skipping (not retryable)');
        res.status(200).json({ received: true, skipped: 'missing metadata' });
        return;
      }

      // Session-level idempotency. The per-finance-doc guard below only runs
      // when the finance doc exists; if it was deleted/renamed, a Stripe retry
      // would otherwise re-post income + fee + GL. Keying on the session id in
      // the income collection covers both cases (mirrors the sponsor branch).
      const existingPlayerIncome = await getDb().collection('income')
        .where('referenceNumber', '==', session.id)
        .limit(1)
        .get();
      if (!existingPlayerIncome.empty) {
        console.log(`Player payment already processed for session ${session.id}, skipping`);
        res.status(200).json({ received: true });
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
        notes: `Stripe processing fee (actual) on session ${session.id}`,
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
        console.error('GL posting failed for player payment:', glErr);
        await getDb().collection('adminNotifications').add({
          type: 'gl_posting_failure',
          severity: 'high',
          message: `GL posting failed for player payment ($${amount.toFixed(2)}) - ${playerName || 'unknown'}. Session: ${session.id}`,
          sourceType: 'income',
          sourceId: incomeRef.id,
          error: String(glErr),
          createdAt: paymentDate,
          read: false,
        });
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

      // 4. Mark invoice token as used — but ONLY when the payment actually
      //    satisfies the invoice. Previously the token was marked used on any
      //    payment, so a $0.50 payment permanently locked a $1,500 invoice as
      //    "paid". For a per-charge token the payment must cover the charge
      //    amount; for a full-balance token the account balance must reach ~0.
      if (invoiceToken) {
        const tokenQuery = await getDb()
          .collection('invoiceTokens')
          .where('token', '==', invoiceToken)
          .limit(1)
          .get();

        if (!tokenQuery.empty) {
          const tokenData = tokenQuery.docs[0].data();
          const EPSILON = 0.005; // half a cent, to absorb rounding

          let invoiceSatisfied: boolean;
          if (tokenData.chargeType && tokenData.chargeType !== 'full_balance') {
            const chargeAmount = tokenData.chargeAmount || tokenData.amountDue || 0;
            invoiceSatisfied = amount >= chargeAmount - EPSILON;
          } else {
            // Recompute the live balance from the just-updated finance record.
            const freshFinance = await financeRef.get();
            if (freshFinance.exists) {
              const fData = freshFinance.data()!;
              const owed = computeFeeTotal(fData) - (fData.scholarshipAmount || 0);
              const paid = (fData.payments || []).reduce(
                (s: number, p: any) => s + (p.amount || 0),
                0
              );
              invoiceSatisfied = paid >= owed - EPSILON;
            } else {
              invoiceSatisfied = false;
            }
          }

          if (invoiceSatisfied) {
            const tokenUpdate: Record<string, any> = {
              used: true,
              usedAt: paymentDate,
              usedBy: session.customer_details?.email || 'stripe',
            };
            if (userId) {
              tokenUpdate.paidByUserId = userId;
            }
            await tokenQuery.docs[0].ref.update(tokenUpdate);
          } else {
            console.log(
              `Invoice token ${invoiceToken} left open — payment of $${amount} did not fully satisfy the invoice`
            );
          }
        }
      }

      // 5. Send payment receipt email — include the up-to-date account balance
      //    (computed from the freshly-updated finance record) so the payer sees
      //    what, if anything, remains owed right in the receipt.
      const recipientEmail = session.customer_details?.email || '';
      if (recipientEmail) {
        let balanceDue: number | undefined;
        let receiptPayUrl: string | undefined;
        try {
          const freshFinance = await financeRef.get();
          if (freshFinance.exists) {
            const fData = freshFinance.data()!;
            const owed = computeFeeTotal(fData) - (fData.scholarshipAmount || 0);
            const paid = (fData.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
            balanceDue = Math.max(0, owed - paid);
            // If a balance remains and this checkout carried an invoice token
            // (left open because it wasn't fully satisfied), reuse it as a pay link.
            if (balanceDue > 0.005 && invoiceToken) {
              receiptPayUrl = `${SITE_URL}/pay/${invoiceToken}`;
            }
          }
        } catch (balErr) {
          console.error('Failed to compute receipt balance:', balErr);
        }
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
            balanceDue,
            paymentUrl: receiptPayUrl,
          });
        } catch (emailErr) {
          console.error('Failed to send receipt email:', emailErr);
          // Don't fail the webhook for email errors
        }
      }

      console.log(`Payment processed: ${amount} for player ${playerName} (finance: ${financeId})`);
    } catch (error) {
      console.error('Error processing webhook:', error);
      // A card was charged but processing failed. Return 200 (so Stripe does not
      // retry against non-idempotent writes) but record a dead-letter + admin
      // alert so the payment is never silently lost and can be reconciled.
      await recordFailedWebhook(event, error);
      res.status(200).json({ received: true, error: 'Processing failed — recorded for review' });
      return;
    }
  }

  // === REFUND HANDLING ===
  if (event.type === 'charge.refunded') {
    try {
      const charge = event.data.object as Stripe.Charge;
      const refundDate = admin.firestore.Timestamp.now();

      // Income records store referenceNumber = the Checkout Session id (cs_...),
      // but the charge only carries the PaymentIntent id (pi_...). Recover the
      // Checkout Session id from the PaymentIntent so the lookup can match.
      let sessionId: string | null = null;
      try {
        if (charge.payment_intent) {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: charge.payment_intent as string,
            limit: 1,
          });
          if (sessions.data.length) sessionId = sessions.data[0].id;
        }
      } catch (lookupErr) {
        console.warn(`Refund: could not resolve session for charge ${charge.id}:`, lookupErr);
      }

      let incomeDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      if (sessionId) {
        const incomeQuery = await getDb().collection('income')
          .where('referenceNumber', '==', sessionId)
          .limit(1)
          .get();
        if (!incomeQuery.empty) incomeDoc = incomeQuery.docs[0];
      }

      if (!incomeDoc) {
        console.warn(`Refund: No income record found for charge ${charge.id} (session ${sessionId ?? 'unknown'})`);
        res.status(200).json({ received: true, skipped: 'no matching income record' });
        return;
      }

      const incomeData = incomeDoc.data();
      const revenueAccount = incomeData.category === 'sponsorships' ? '4100' : '4000';

      // Process each INDIVIDUAL refund on this charge. Idempotency is keyed on
      // the refund id (not the charge), so a second/partial refund is recorded
      // for its own delta instead of being skipped as a "duplicate charge".
      let refunds: Stripe.Refund[] = charge.refunds?.data || [];
      if (refunds.length === 0 && charge.id) {
        try {
          const list = await stripe.refunds.list({ charge: charge.id, limit: 100 });
          refunds = list.data;
        } catch (listErr) {
          console.warn(`Refund: could not list refunds for charge ${charge.id}:`, listErr);
        }
      }

      let processedAny = false;
      let newlyRefunded = 0;

      for (const refund of refunds) {
        const existingRefund = await getDb().collection('income')
          .where('referenceNumber', '==', `refund_${refund.id}`)
          .limit(1)
          .get();
        if (!existingRefund.empty) continue; // this refund already recorded

        const amt = (refund.amount || 0) / 100;
        processedAny = true;
        newlyRefunded += amt;

        // 1. Negative income record for THIS refund
        const refundIncomeRef = await getDb().collection('income').add({
          date: refundDate,
          category: incomeData.category || 'player_payments',
          amount: -amt,
          source: incomeData.source || 'Stripe Refund',
          description: `Refund: ${incomeData.description || 'Stripe payment'}`,
          payerName: incomeData.payerName || '',
          paymentMethod: 'credit_card',
          referenceNumber: `refund_${refund.id}`,
          playerId: incomeData.playerId || '',
          teamId: incomeData.teamId || '',
          season: incomeData.season || '',
          notes: `Stripe refund ${refund.id} on charge ${charge.id}. Original income: ${incomeDoc.id}`,
          sourcePaymentId: incomeData.sourcePaymentId || '',
          sourceFinanceId: incomeData.sourceFinanceId || '',
          reconciled: false,
          recordedBy: 'stripe_webhook',
          createdAt: refundDate,
          updatedAt: refundDate,
        });

        // 2. Reversing GL entries (debit Revenue, credit Cash) for THIS refund
        try {
          const glBatch = getDb().batch();
          glBatch.set(getDb().collection('generalLedger').doc(), {
            date: refundDate,
            accountNumber: revenueAccount,
            accountName: revenueAccount === '4100' ? 'Sponsorship Revenue' : 'Player Payment Revenue',
            type: 'debit',
            amount: amt,
            description: `Refund reversal: ${incomeData.description || 'payment'}`,
            sourceType: 'income',
            sourceId: refundIncomeRef.id,
            createdBy: 'stripe_webhook',
            createdAt: refundDate,
          });
          glBatch.set(getDb().collection('generalLedger').doc(), {
            date: refundDate,
            accountNumber: '1000',
            accountName: 'Cash - Checking',
            type: 'credit',
            amount: amt,
            description: `Refund reversal: ${incomeData.description || 'payment'}`,
            sourceType: 'income',
            sourceId: refundIncomeRef.id,
            createdBy: 'stripe_webhook',
            createdAt: refundDate,
          });
          await glBatch.commit();
        } catch (glErr) {
          console.error('GL posting failed for refund:', glErr);
          await getDb().collection('adminNotifications').add({
            type: 'gl_posting_failure',
            severity: 'high',
            message: `GL posting failed for refund of $${amt.toFixed(2)}. Charge: ${charge.id}, Refund: ${refund.id}`,
            sourceType: 'income',
            sourceId: refundIncomeRef.id,
            error: String(glErr),
            createdAt: refundDate,
            read: false,
          });
        }
      }

      if (!processedAny) {
        console.log(`All refunds already processed for charge ${charge.id}, skipping`);
        res.status(200).json({ received: true });
        return;
      }

      // 3. Update the player finance record: record the CUMULATIVE amount
      // refunded on this charge, and only flag the payment fully 'refunded'
      // when the entire charge has been returned (a partial refund is not).
      const cumulativeRefunded = (charge.amount_refunded || 0) / 100;
      const fullyRefunded = (charge.amount_refunded || 0) >= (charge.amount || 0) && (charge.amount || 0) > 0;
      if (incomeData.sourceFinanceId) {
        const financeRef = getDb().collection('playerFinances').doc(incomeData.sourceFinanceId);
        const financeDoc = await financeRef.get();
        if (financeDoc.exists) {
          const payments: any[] = financeDoc.data()!.payments || [];
          const updatedPayments = payments.map((p: any) => {
            if (p.stripeSessionId === sessionId || p.reference === sessionId) {
              return {
                ...p,
                refunded: fullyRefunded,
                partialRefund: !fullyRefunded,
                refundAmount: cumulativeRefunded,
                refundDate,
                refundChargeId: charge.id,
              };
            }
            return p;
          });
          await financeRef.update({ payments: updatedPayments, updatedAt: refundDate });
        }
      }

      // 4. Create admin notification
      await getDb().collection('adminNotifications').add({
        type: 'payment_refunded',
        severity: 'medium',
        message: `Refund of $${newlyRefunded.toFixed(2)} processed for ${incomeData.payerName || 'unknown payer'} ($${cumulativeRefunded.toFixed(2)} total on this charge${fullyRefunded ? ', fully refunded' : ', partial'}). Charge: ${charge.id}`,
        createdAt: refundDate,
        read: false,
      });

      console.log(`Refund processed: $${newlyRefunded} (cumulative $${cumulativeRefunded}) for charge ${charge.id}`);
    } catch (error) {
      console.error('Error processing refund webhook:', error);
      await recordFailedWebhook(event, error);
      res.status(200).json({ received: true, error: 'Refund processing failed — recorded for review' });
      return;
    }
  }

  // === DISPUTE HANDLING ===
  if (event.type === 'charge.dispute.created') {
    try {
      const dispute = event.data.object as Stripe.Dispute;
      const disputeAmount = (dispute.amount || 0) / 100;
      await getDb().collection('adminNotifications').add({
        type: 'payment_dispute',
        severity: 'critical',
        message: `Chargeback dispute opened for $${disputeAmount.toFixed(2)}. Charge: ${dispute.charge}. Reason: ${dispute.reason}. Respond by ${new Date((dispute.evidence_details?.due_by || 0) * 1000).toLocaleDateString()}.`,
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount: disputeAmount,
        reason: dispute.reason,
        createdAt: admin.firestore.Timestamp.now(),
        read: false,
      });
      console.log(`Dispute notification created for charge ${dispute.charge}`);
    } catch (error) {
      console.error('Error processing dispute webhook:', error);
    }
  }

  res.status(200).json({ received: true });
});
