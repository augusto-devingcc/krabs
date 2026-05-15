import { createHash, randomBytes } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a new API key plaintext: `crm_live_` + 40 url-safe chars (~240 bits).
 */
export function generateApiKeyPlaintext(): string {
  const random = randomBytes(30).toString("base64url");
  return `crm_live_${random}`;
}

export function apiKeyPreview(plaintext: string): string {
  // "crm_live_abc123…" — first 12 chars after prefix
  return `${plaintext.slice(0, 16)}…`;
}
