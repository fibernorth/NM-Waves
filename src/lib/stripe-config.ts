/**
 * Stripe configuration constants.
 * The publishable key is safe to expose in client code.
 */
export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export const APP_URL =
  import.meta.env.VITE_APP_URL || window.location.origin;
