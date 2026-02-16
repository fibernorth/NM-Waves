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
exports.stripeWebhook = exports.createCheckoutSession = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const db = admin.firestore();
function getStripe() {
    var _a;
    const secretKey = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new Error('Stripe secret key not configured');
    }
    return new stripe_1.default(secretKey, { apiVersion: '2023-10-16' });
}
/**
 * Creates a Stripe Checkout Session for a payment.
 * Called by the client to initiate Stripe Checkout.
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    var _a;
    const { financeId, playerId, amount, sponsorId, isAnonymous, invoiceToken, returnUrl, payerEmail, payerName } = data;
    if (!financeId || !playerId || !amount || !returnUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    // Validate returnUrl to prevent open redirect
    const allowedHosts = ['localhost', '127.0.0.1', 'tcwavesballclub.com', 'www.tcwavesballclub.com'];
    try {
        const urlObj = new URL(returnUrl);
        if (!allowedHosts.some(h => urlObj.hostname === h || urlObj.hostname.endsWith(`.${h}`))) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid return URL');
        }
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError)
            throw e;
        throw new functions.https.HttpsError('invalid-argument', 'Invalid return URL format');
    }
    if (amount < 0.5) {
        throw new functions.https.HttpsError('invalid-argument', 'Amount must be at least $0.50');
    }
    // Fetch player finance to get player/team info
    const financeDoc = await db.collection('playerFinances').doc(financeId).get();
    if (!financeDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Finance record not found');
    }
    const financeData = financeDoc.data();
    const stripe = getStripe();
    const metadata = {
        financeId,
        playerId,
        playerName: financeData.playerName || '',
        teamName: financeData.teamName || '',
        season: financeData.season || '',
    };
    if (sponsorId)
        metadata.sponsorId = sponsorId;
    if (isAnonymous)
        metadata.isAnonymous = 'true';
    if (invoiceToken)
        metadata.invoiceToken = invoiceToken;
    if (payerName)
        metadata.payerName = payerName;
    if ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)
        metadata.userId = context.auth.uid;
    const sessionParams = {
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
});
/**
 * Stripe webhook handler for processing completed payments.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const stripe = getStripe();
    const webhookSecret = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret) || process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    if (!webhookSecret) {
        console.error('Stripe webhook secret not configured');
        res.status(500).send('Webhook secret not configured');
        return;
    }
    try {
        const sig = req.headers['stripe-signature'];
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};
        try {
            const { financeId, playerId, playerName, teamName, season, sponsorId, isAnonymous, invoiceToken, payerName, } = metadata;
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
                const data = financeDoc.data();
                const payments = data.payments || [];
                const newPayment = {
                    id: paymentId,
                    amount,
                    date: paymentDate,
                    method: 'stripe',
                    reference: session.id,
                    notes: sponsorId
                        ? `Stripe payment${isAnonymous === 'true' ? ' (anonymous sponsor)' : ''}`
                        : 'Stripe payment',
                    payerName: payerName || ((_b = session.customer_details) === null || _b === void 0 ? void 0 : _b.name) || '',
                    payerEmail: ((_c = session.customer_details) === null || _c === void 0 ? void 0 : _c.email) || '',
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
                        newPayment.sponsorName = sponsorDoc.data().businessName;
                    }
                }
                payments.push(newPayment);
                await financeRef.update({ payments, updatedAt: paymentDate });
            }
            // 2. Record income entry
            const incomeCategory = sponsorId ? 'sponsorships' : 'player_payments';
            let incomeSource = payerName || ((_d = session.customer_details) === null || _d === void 0 ? void 0 : _d.name) || 'Stripe Payment';
            if (sponsorId) {
                const sponsorDoc = await db.collection('sponsors').doc(sponsorId).get();
                if (sponsorDoc.exists) {
                    incomeSource = sponsorDoc.data().businessName;
                }
            }
            await db.collection('income').add({
                date: paymentDate,
                category: incomeCategory,
                amount,
                source: incomeSource,
                description: `Stripe payment for ${playerName || 'player'}`,
                payerName: payerName || ((_e = session.customer_details) === null || _e === void 0 ? void 0 : _e.name) || '',
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
                    const sponsorData = sponsorDoc.data();
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
                        usedBy: ((_f = session.customer_details) === null || _f === void 0 ? void 0 : _f.email) || 'stripe',
                    });
                }
            }
            console.log(`Payment processed: ${amount} for player ${playerName} (finance: ${financeId})`);
        }
        catch (error) {
            console.error('Error processing webhook:', error);
            res.status(500).send('Internal error processing payment');
            return;
        }
    }
    res.status(200).json({ received: true });
});
//# sourceMappingURL=stripe.js.map