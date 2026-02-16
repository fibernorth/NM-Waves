import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const db = admin.firestore();

function getStripe(): Stripe {
  const secretKey = functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key not configured');
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
}

interface CheckoutSessionParams {
  financeId: string;
  playerId: string;
  amount: number;
  sponsorId?: string;
  isAnonymous?: boolean;
  invoiceToken?: string;
  returnUrl: string;
  payerEmail?: string;
  payerName?: string;
}

/**
 * Creates a Stripe Checkout Session for a payment.
 * Called by the client to initiate Stripe Checkout.
 */
export const createCheckoutSession = functions.https.onCall(
  async (data: CheckoutSessionParams, context) => {
    const { financeId, playerId, amount, sponsorId, isAnonymous, invoiceToken, returnUrl, payerEmail, payerName } = data;

    if (!financeId || !playerId || !amount || !returnUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    if (amount < 0.5) {
      throw new functions.https.HttpsError('invalid-argument', 'Amount must be at least $0.50');
    }

    // Fetch player finance to get player/team info
    const financeDoc = await db.collection('playerFinances').doc(financeId).get();
    if (!financeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Finance record not found');
    }
    const financeData = financeDoc.data()!;

    const stripe = getStripe();

    const metadata: Record<string, string> = {
      financeId,
      playerId,
      playerName: financeData.playerName || '',
      teamName: financeData.teamName || '',
      season: financeData.season || '',
    };

    if (sponsorId) metadata.sponsorId = sponsorId;
    if (isAnonymous) metadata.isAnonymous = 'true';
    if (invoiceToken) metadata.invoiceToken = invoiceToken;
    if (payerName) metadata.payerName = payerName;
    if (context.auth?.uid) metadata.userId = context.auth.uid;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Payment for ${financeData.playerName}`,
              description: `${financeData.teamName} - ${financeData.season}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${returnUrl}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}/pay/cancel`,
    };

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

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      const sig = req.headers['stripe-signature'] as string;
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } else {
      event = req.body as Stripe.Event;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    try {
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
      } = metadata;

      if (!financeId || !playerId) {
        console.error('Missing financeId or playerId in session metadata');
        res.status(400).send('Missing metadata');
        return;
      }

      const amount = (session.amount_total || 0) / 100;
      // Stripe processing fee: 2.9% + $0.30 for card payments
      const processingFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
      const paymentDate = admin.firestore.Timestamp.now();
      const paymentId = `stripe_${session.id}`;

      // 1. Record payment on player's finance record
      const financeRef = db.collection('playerFinances').doc(financeId);
      const financeDoc = await financeRef.get();

      if (financeDoc.exists) {
        const data = financeDoc.data()!;
        const payments = data.payments || [];

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
          // Fetch sponsor name
          const sponsorDoc = await db.collection('sponsors').doc(sponsorId).get();
          if (sponsorDoc.exists) {
            newPayment.sponsorName = sponsorDoc.data()!.businessName;
          }
        }

        payments.push(newPayment);
        await financeRef.update({ payments, updatedAt: paymentDate });
      }

      // 2. Record income entry
      const incomeCategory = sponsorId ? 'sponsorships' : 'player_payments';
      let incomeSource = payerName || session.customer_details?.name || 'Stripe Payment';
      if (sponsorId) {
        const sponsorDoc = await db.collection('sponsors').doc(sponsorId).get();
        if (sponsorDoc.exists) {
          incomeSource = sponsorDoc.data()!.businessName;
        }
      }

      await db.collection('income').add({
        date: paymentDate,
        category: incomeCategory,
        amount,
        source: incomeSource,
        description: `Stripe payment for ${playerName || 'player'}`,
        payerName: payerName || session.customer_details?.name || '',
        paymentMethod: 'credit_card',
        referenceNumber: session.id,
        playerId,
        season: season || '',
        notes: `Stripe Checkout Session: ${session.id}`,
        recordedBy: 'stripe_webhook',
        createdAt: paymentDate,
        updatedAt: paymentDate,
      });

      // 2b. Record processing fee as an expense (for accurate accounting)
      await db.collection('expenses').add({
        date: paymentDate,
        category: 'administrative',
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

      // 3. If sponsor: update sponsor record
      if (sponsorId) {
        const sponsorRef = db.collection('sponsors').doc(sponsorId);
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
        const tokenQuery = await db
          .collection('invoiceTokens')
          .where('token', '==', invoiceToken)
          .limit(1)
          .get();

        if (!tokenQuery.empty) {
          await tokenQuery.docs[0].ref.update({
            used: true,
            usedAt: paymentDate,
            usedBy: session.customer_details?.email || 'stripe',
          });
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
