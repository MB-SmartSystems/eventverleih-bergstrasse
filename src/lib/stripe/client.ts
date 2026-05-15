/**
 * Stripe-Client Singleton.
 *
 * ENV-Required:
 *   STRIPE_SECRET_KEY      = sk_test_... oder sk_live_...
 *   STRIPE_WEBHOOK_SECRET  = whsec_... (fuer Signature-Verify)
 */
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing in env");
  _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return _stripe;
}

export function getWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET missing in env");
  return s;
}
