import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Read the 32-byte encryption key from `KRABS_CRED_ENCRYPTION_KEY` (base64).
 * Generated once at install via: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
 *
 * In dev mode, we fall back to a derived key from a fixed string so the
 * `encrypted` columns roundtrip — but ANYTHING encrypted under the dev key
 * is reset every time the env changes. Production MUST set a real key.
 */
function getKey(): Buffer {
  const raw = process.env.KRABS_CRED_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "KRABS_CRED_ENCRYPTION_KEY is required in production. " +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    }
    // Dev fallback — derived from a fixed string. Stable enough for local
    // testing, but anything encrypted with this is throwaway.
    return Buffer.from("krabs-dev-encryption-key-NOT-SECURE-32!".padEnd(KEY_LENGTH, "0")).subarray(0, KEY_LENGTH);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `KRABS_CRED_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (base64). Got ${key.length}.`,
    );
  }
  return key;
}

/**
 * Encrypt a plaintext credential string. Returns a base64 payload of:
 *   [iv (12 bytes)][auth_tag (16 bytes)][ciphertext]
 * Caller stores this opaque blob; decryption needs only the env key.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypt a value previously produced by `encryptSecret`. Throws if the
 * payload is malformed, the auth tag doesn't verify, or the key is wrong.
 */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("encrypted payload too short to be valid");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Return only the last `n` characters of a secret, prefixed with `…`,
 * for safe display in the dashboard ("Connected · key …Wx2k").
 */
export function maskSecret(plaintext: string, lastN: number = 4): string {
  if (plaintext.length <= lastN) return "…" + plaintext;
  return "…" + plaintext.slice(-lastN);
}
