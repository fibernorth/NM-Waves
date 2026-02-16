import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase/config';
import { APP_URL } from '@/lib/stripe-config';

const functions = getFunctions(app);

interface CheckoutSessionParams {
  financeId: string;
  playerId: string;
  amount: number;
  sponsorId?: string;
  isAnonymous?: boolean;
  invoiceToken?: string;
  payerEmail?: string;
  payerName?: string;
}

interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

/**
 * Creates a Stripe Checkout session and redirects to the Stripe-hosted payment page.
 */
export async function createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
  const callable = httpsCallable<CheckoutSessionParams & { returnUrl: string }, CheckoutSessionResult>(
    functions,
    'createCheckoutSession'
  );

  const result = await callable({
    ...params,
    returnUrl: APP_URL,
  });

  return result.data;
}

/**
 * Creates a checkout session and immediately redirects the browser.
 */
export async function redirectToCheckout(params: CheckoutSessionParams): Promise<void> {
  const { url } = await createCheckoutSession(params);
  if (url) {
    window.location.href = url;
  } else {
    throw new Error('No checkout URL returned from Stripe');
  }
}
