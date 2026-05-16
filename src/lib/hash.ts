import { createHash, randomBytes } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a new API key plaintext: `krabs_sk_` + 40 url-safe chars (~240 bits).
 */
export function generateApiKeyPlaintext(): string {
  const random = randomBytes(30).toString("base64url");
  return `krabs_sk_${random}`;
}

export function apiKeyPreview(plaintext: string): string {
  return `${plaintext.slice(0, 16)}…`;
}
