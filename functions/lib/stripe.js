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
const emails_1 = require("./emails");
const getDb = () => admin.firestore();
/**
 * Compute fee total from a player finance document.
 * Must match the formula in src/lib/api/finances.ts → computeFeeTotal.
 */
const computeFeeTotal = (data) => (data.registrationFee || 0) +
    (data.uniformCost || 0) +
    (data.tournamentFees || 0) +
    (data.facilityFees || 0) +
    (data.equipmentFees || 0) +
    (data.otherFees || 0);
function getStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new Error('Stripe secret key not configured (set STRIPE_SECRET_KEY)');
    }
    return new stripe_1.default(secretKey, { apiVersion: '2023-10-16' });
}
/**
 * Creates a Stripe Checkout Session for a payment.
 * Called by the client to initiate Stripe Checkout.
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
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
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError)
            throw e;
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
        if (((_a = tokenData.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate()) < new Date()) {
            throw new functions.https.HttpsError('failed-precondition', 'This invoice has expired');
        }
        // The token must belong to the finance record being paid, otherwise a
        // token for player A could be consumed while crediting player B.
        if (tokenData.financeId && financeId && tokenData.financeId !== financeId) {
            throw new functions.https.HttpsError('failed-precondition', 'Invoice token does not match this account');
        }
    }
    const stripe = getStripe();
    const metadata = {};
    let productName;
    let productDescription;
    if (isSponsorPayment) {
        // Sponsor payment — no finance record needed
        metadata.paymentType = 'sponsorship';
        metadata.sponsorBusinessName = sponsorBusinessName;
        if (sponsorshipTarget)
            metadata.sponsorshipTarget = sponsorshipTarget;
        if (sponsorNotes)
            metadata.sponsorNotes = sponsorNotes;
        if (payerName)
            metadata.payerName = payerName;
        if ((_b = context.auth) === null || _b === void 0 ? void 0 : _b.uid)
            metadata.userId = context.auth.uid;
        productName = `Sponsorship from ${sponsorBusinessName}`;
        const targetLabel = sponsorshipTarget === 'player' ? 'Player Sponsorship' :
            sponsorshipTarget === 'team' ? 'Team Sponsorship' : 'Organization Sponsorship';
        productDescription = targetLabel + (sponsorNotes ? ` — ${sponsorNotes}` : '');
    }
    else {
        // Player payment — requires finance record
        const financeDoc = await getDb().collection('playerFinances').doc(financeId).get();
        if (!financeDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Finance record not found');
        }
        const financeData = financeDoc.data();
        metadata.financeId = financeId;
        metadata.playerId = playerId;
        metadata.playerName = financeData.playerName || '';
        metadata.teamName = financeData.teamName || '';
        metadata.season = financeData.season || '';
        if (sponsorId)
            metadata.sponsorId = sponsorId;
        if (isAnonymous)
            metadata.isAnonymous = 'true';
        if (invoiceToken)
            metadata.invoiceToken = invoiceToken;
        if (payerName)
            metadata.payerName = payerName;
        if ((_c = context.auth) === null || _c === void 0 ? void 0 : _c.uid)
            metadata.userId = context.auth.uid;
        productName = `Payment for ${financeData.playerName}`;
        productDescription = `${financeData.teamName} - ${financeData.season}`;
    }
    const sessionParams = {
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
});
/**
 * Stripe webhook handler for processing completed payments.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event = undefined;
    // Try signature verification first (works with legacy webhook endpoints).
    // If it fails, fall back to parsing the body and verifying via the Stripe API
    // (works with new-style Event Destinations which use a different signing protocol).
    const sig = req.headers['stripe-signature'];
    let verified = false;
    if (webhookSecret && sig) {
        try {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
            verified = true;
            console.log('Webhook verified via signature');
        }
        catch (err) {
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
        }
        catch (err) {
            console.error('Webhook verification failed (both methods):', err.message);
            res.status(400).send('Webhook verification failed');
            return;
        }
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};
        try {
            const amount = (session.amount_total || 0) / 100;
            const processingFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;
            const paymentDate = admin.firestore.Timestamp.now();
            const paymentId = `stripe_${session.id}`;
            // === SPONSOR-ONLY PAYMENT (no financeId) ===
            if (metadata.paymentType === 'sponsorship') {
                const businessName = metadata.sponsorBusinessName || ((_a = session.customer_details) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Sponsor';
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
                    contactName: metadata.payerName || ((_b = session.customer_details) === null || _b === void 0 ? void 0 : _b.name) || '',
                    contactEmail: ((_c = session.customer_details) === null || _c === void 0 ? void 0 : _c.email) || '',
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
                    payerName: metadata.payerName || ((_d = session.customer_details) === null || _d === void 0 ? void 0 : _d.name) || '',
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
                }
                catch (glErr) {
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
            const { financeId, playerId, playerName, teamName, season, sponsorId, isAnonymous, invoiceToken, payerName, userId, } = metadata;
            if (!financeId || !playerId) {
                console.error('Missing financeId or playerId in session metadata — skipping (not retryable)');
                res.status(200).json({ received: true, skipped: 'missing metadata' });
                return;
            }
            // 1. Record payment on player's finance record
            const financeRef = getDb().collection('playerFinances').doc(financeId);
            const financeDoc = await financeRef.get();
            let payments = [];
            if (financeDoc.exists) {
                const data = financeDoc.data();
                payments = data.payments || [];
                // Idempotency check
                const alreadyProcessed = payments.some((p) => p.stripeSessionId === session.id);
                if (alreadyProcessed) {
                    console.log(`Payment already processed for session ${session.id}, skipping`);
                    res.status(200).json({ received: true });
                    return;
                }
                const newPayment = {
                    id: paymentId,
                    amount,
                    date: paymentDate,
                    method: 'stripe',
                    reference: session.id,
                    notes: sponsorId
                        ? `Stripe payment${isAnonymous === 'true' ? ' (anonymous sponsor)' : ''}`
                        : 'Stripe payment',
                    payerName: payerName || ((_e = session.customer_details) === null || _e === void 0 ? void 0 : _e.name) || '',
                    payerEmail: ((_f = session.customer_details) === null || _f === void 0 ? void 0 : _f.email) || '',
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
                        newPayment.sponsorName = sponsorDoc.data().businessName;
                    }
                }
                payments.push(newPayment);
                // Don't write yet — we'll add the incomeRecordId first, then write once
            }
            // 2. Record income entry (tagged with sourcePaymentId for reconciliation)
            const incomeCategory = sponsorId ? 'sponsorships' : 'player_payments';
            let incomeSource = payerName || ((_g = session.customer_details) === null || _g === void 0 ? void 0 : _g.name) || 'Stripe Payment';
            if (sponsorId) {
                const sponsorDoc = await getDb().collection('sponsors').doc(sponsorId).get();
                if (sponsorDoc.exists) {
                    incomeSource = sponsorDoc.data().businessName;
                }
            }
            const incomeRef = await getDb().collection('income').add({
                date: paymentDate,
                category: incomeCategory,
                amount,
                source: incomeSource,
                description: `Stripe payment for ${playerName || 'player'}`,
                payerName: payerName || ((_h = session.customer_details) === null || _h === void 0 ? void 0 : _h.name) || '',
                paymentMethod: 'credit_card',
                referenceNumber: session.id,
                playerId,
                teamId: financeDoc.exists ? financeDoc.data().teamId || '' : '',
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
                const finalPayments = payments.map((p) => p.id === paymentId ? { ...p, incomeRecordId: incomeRef.id } : p);
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
            }
            catch (glErr) {
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
                    let invoiceSatisfied;
                    if (tokenData.chargeType && tokenData.chargeType !== 'full_balance') {
                        const chargeAmount = tokenData.chargeAmount || tokenData.amountDue || 0;
                        invoiceSatisfied = amount >= chargeAmount - EPSILON;
                    }
                    else {
                        // Recompute the live balance from the just-updated finance record.
                        const freshFinance = await financeRef.get();
                        if (freshFinance.exists) {
                            const fData = freshFinance.data();
                            const owed = computeFeeTotal(fData) - (fData.scholarshipAmount || 0);
                            const paid = (fData.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
                            invoiceSatisfied = paid >= owed - EPSILON;
                        }
                        else {
                            invoiceSatisfied = false;
                        }
                    }
                    if (invoiceSatisfied) {
                        const tokenUpdate = {
                            used: true,
                            usedAt: paymentDate,
                            usedBy: ((_j = session.customer_details) === null || _j === void 0 ? void 0 : _j.email) || 'stripe',
                        };
                        if (userId) {
                            tokenUpdate.paidByUserId = userId;
                        }
                        await tokenQuery.docs[0].ref.update(tokenUpdate);
                    }
                    else {
                        console.log(`Invoice token ${invoiceToken} left open — payment of $${amount} did not fully satisfy the invoice`);
                    }
                }
            }
            // 5. Send payment receipt email
            const recipientEmail = ((_k = session.customer_details) === null || _k === void 0 ? void 0 : _k.email) || '';
            if (recipientEmail) {
                try {
                    await (0, emails_1.sendPaymentReceipt)({
                        email: recipientEmail,
                        amount,
                        playerName: playerName || 'Player',
                        teamName: teamName || '',
                        season: season || '',
                        date: new Date(),
                        sponsorBusinessName: sponsorId ? (_l = (await getDb().collection('sponsors').doc(sponsorId).get()).data()) === null || _l === void 0 ? void 0 : _l.businessName : undefined,
                        stripeSessionId: session.id,
                    });
                }
                catch (emailErr) {
                    console.error('Failed to send receipt email:', emailErr);
                    // Don't fail the webhook for email errors
                }
            }
            console.log(`Payment processed: ${amount} for player ${playerName} (finance: ${financeId})`);
        }
        catch (error) {
            console.error('Error processing webhook:', error);
            // Return 200 to prevent Stripe retry storms on permanent failures.
            // The error is logged for admin review.
            res.status(200).json({ received: true, error: 'Processing failed — logged for review' });
            return;
        }
    }
    // === REFUND HANDLING ===
    if (event.type === 'charge.refunded') {
        try {
            const charge = event.data.object;
            const refundAmount = (charge.amount_refunded || 0) / 100;
            const sessionId = charge.payment_intent;
            const refundDate = admin.firestore.Timestamp.now();
            // Find the income record linked to this payment
            const incomeQuery = await getDb().collection('income')
                .where('referenceNumber', '==', sessionId)
                .limit(1)
                .get();
            if (incomeQuery.empty) {
                // Try matching by Stripe session ID in the charge metadata
                const metaSessionId = ((_m = charge.metadata) === null || _m === void 0 ? void 0 : _m.stripeSessionId) || ((_o = charge.metadata) === null || _o === void 0 ? void 0 : _o.session_id);
                if (metaSessionId) {
                    const altQuery = await getDb().collection('income')
                        .where('referenceNumber', '==', metaSessionId)
                        .limit(1)
                        .get();
                    if (altQuery.empty) {
                        console.warn(`Refund: No income record found for charge ${charge.id}`);
                        res.status(200).json({ received: true, skipped: 'no matching income record' });
                        return;
                    }
                }
                else {
                    console.warn(`Refund: No income record found for charge ${charge.id}`);
                    res.status(200).json({ received: true, skipped: 'no matching income record' });
                    return;
                }
            }
            const incomeDoc = incomeQuery.empty ? null : incomeQuery.docs[0];
            if (!incomeDoc) {
                res.status(200).json({ received: true, skipped: 'no matching income record' });
                return;
            }
            const incomeData = incomeDoc.data();
            // Idempotency: check if we already processed this refund
            const existingRefund = await getDb().collection('income')
                .where('referenceNumber', '==', `refund_${charge.id}`)
                .limit(1)
                .get();
            if (!existingRefund.empty) {
                console.log(`Refund already processed for charge ${charge.id}, skipping`);
                res.status(200).json({ received: true });
                return;
            }
            // 1. Create a negative income record (refund)
            const refundIncomeRef = await getDb().collection('income').add({
                date: refundDate,
                category: incomeData.category || 'player_payments',
                amount: -refundAmount,
                source: incomeData.source || 'Stripe Refund',
                description: `Refund: ${incomeData.description || 'Stripe payment'}`,
                payerName: incomeData.payerName || '',
                paymentMethod: 'credit_card',
                referenceNumber: `refund_${charge.id}`,
                playerId: incomeData.playerId || '',
                teamId: incomeData.teamId || '',
                season: incomeData.season || '',
                notes: `Stripe refund on charge ${charge.id}. Original income: ${incomeDoc.id}`,
                sourcePaymentId: incomeData.sourcePaymentId || '',
                sourceFinanceId: incomeData.sourceFinanceId || '',
                reconciled: false,
                recordedBy: 'stripe_webhook',
                createdAt: refundDate,
                updatedAt: refundDate,
            });
            // 2. Post reversing GL entries (debit Revenue, credit Cash)
            try {
                const revenueAccount = incomeData.category === 'sponsorships' ? '4100' : '4000';
                const glBatch = getDb().batch();
                glBatch.set(getDb().collection('generalLedger').doc(), {
                    date: refundDate,
                    accountNumber: revenueAccount,
                    accountName: revenueAccount === '4100' ? 'Sponsorship Revenue' : 'Player Payment Revenue',
                    type: 'debit',
                    amount: refundAmount,
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
                    amount: refundAmount,
                    description: `Refund reversal: ${incomeData.description || 'payment'}`,
                    sourceType: 'income',
                    sourceId: refundIncomeRef.id,
                    createdBy: 'stripe_webhook',
                    createdAt: refundDate,
                });
                await glBatch.commit();
            }
            catch (glErr) {
                console.error('GL posting failed for refund:', glErr);
                await getDb().collection('adminNotifications').add({
                    type: 'gl_posting_failure',
                    severity: 'high',
                    message: `GL posting failed for refund of $${refundAmount.toFixed(2)}. Charge: ${charge.id}`,
                    sourceType: 'income',
                    sourceId: refundIncomeRef.id,
                    error: String(glErr),
                    createdAt: refundDate,
                    read: false,
                });
            }
            // 3. Update the player finance record if applicable
            if (incomeData.sourceFinanceId) {
                const financeRef = getDb().collection('playerFinances').doc(incomeData.sourceFinanceId);
                const financeDoc = await financeRef.get();
                if (financeDoc.exists) {
                    const payments = financeDoc.data().payments || [];
                    // Mark the original payment as refunded
                    const updatedPayments = payments.map((p) => {
                        if (p.stripeSessionId === sessionId || p.reference === sessionId) {
                            return { ...p, refunded: true, refundAmount, refundDate, refundChargeId: charge.id };
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
                message: `Refund of $${refundAmount.toFixed(2)} processed for ${incomeData.payerName || 'unknown payer'}. Charge: ${charge.id}`,
                createdAt: refundDate,
                read: false,
            });
            console.log(`Refund processed: $${refundAmount} for charge ${charge.id}`);
        }
        catch (error) {
            console.error('Error processing refund webhook:', error);
            res.status(200).json({ received: true, error: 'Refund processing failed — logged for review' });
            return;
        }
    }
    // === DISPUTE HANDLING ===
    if (event.type === 'charge.dispute.created') {
        try {
            const dispute = event.data.object;
            const disputeAmount = (dispute.amount || 0) / 100;
            await getDb().collection('adminNotifications').add({
                type: 'payment_dispute',
                severity: 'critical',
                message: `Chargeback dispute opened for $${disputeAmount.toFixed(2)}. Charge: ${dispute.charge}. Reason: ${dispute.reason}. Respond by ${new Date((((_p = dispute.evidence_details) === null || _p === void 0 ? void 0 : _p.due_by) || 0) * 1000).toLocaleDateString()}.`,
                disputeId: dispute.id,
                chargeId: dispute.charge,
                amount: disputeAmount,
                reason: dispute.reason,
                createdAt: admin.firestore.Timestamp.now(),
                read: false,
            });
            console.log(`Dispute notification created for charge ${dispute.charge}`);
        }
        catch (error) {
            console.error('Error processing dispute webhook:', error);
        }
    }
    res.status(200).json({ received: true });
});
//# sourceMappingURL=stripe.js.map