import Stripe from "stripe";

// Per-integration client cache — Stripe SDK is stateless, but instantiation
// allocates a request agent and event emitter. Re-using the same instance
// across requests for the same key is materially cheaper at hot paths
// (the webhook handler runs on every Stripe event for every connected account).
const clientCache = new Map<string, Stripe>();

export function getStripeClient(secretKey: string): Stripe {
  const cached = clientCache.get(secretKey);
  if (cached) return cached;
  // Pin to the SDK's bundled latest version so request/response types match
  // what we typecheck against. The SDK enforces a literal type on `apiVersion`,
  // so we use the constant rather than a string.
  const fresh = new Stripe(secretKey, { apiVersion: Stripe.API_VERSION });
  clientCache.set(secretKey, fresh);
  return fresh;
}

export function clearStripeClientCache(): void {
  clientCache.clear();
}
