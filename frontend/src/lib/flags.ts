/** Judging build: PayPal is the only payment rail. Set VITE_PAYPAL_ONLY=true on the Vercel project. */
export const PAYPAL_ONLY = import.meta.env.VITE_PAYPAL_ONLY === 'true'
