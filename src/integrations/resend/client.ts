import { Resend } from "resend";

// Per-key client cache. The Resend SDK is a thin wrapper around fetch but
// caching avoids re-allocating per request on hot send paths.
const clientCache = new Map<string, Resend>();

export function getResendClient(secretKey: string): Resend {
  const cached = clientCache.get(secretKey);
  if (cached) return cached;
  const fresh = new Resend(secretKey);
  clientCache.set(secretKey, fresh);
  return fresh;
}

export function clearResendClientCache(): void {
  clientCache.clear();
}
