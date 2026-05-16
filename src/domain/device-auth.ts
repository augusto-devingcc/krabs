import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys, deviceAuthorizations } from "../db/schema.js";
import type { DeviceAuthorizationRow } from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } from "../lib/hash.js";

const DEVICE_CODE_BYTES = 24;
const USER_CODE_GROUPS = 2;
const USER_CODE_GROUP_LEN = 4;
// Crockford-ish alphabet — no 0/O/1/I to avoid the human typing ambiguity.
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const DEFAULT_TTL_SECONDS = 600;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;

export const POLL_INTERVAL_SECONDS = DEFAULT_POLL_INTERVAL_SECONDS;
export const DEVICE_CODE_TTL_SECONDS = DEFAULT_TTL_SECONDS;

export type ClientMeta = {
  clientName?: string;
  userAgent?: string;
  ip?: string;
};

export type CreateDeviceAuthResult = {
  id: string;
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
};

function generateDeviceCode(): string {
  return `dev_${randomBytes(DEVICE_CODE_BYTES).toString("base64url")}`;
}

function generateUserCode(): string {
  const out: string[] = [];
  for (let g = 0; g < USER_CODE_GROUPS; g++) {
    let group = "";
    const bytes = randomBytes(USER_CODE_GROUP_LEN);
    for (let i = 0; i < USER_CODE_GROUP_LEN; i++) {
      group += USER_CODE_ALPHABET.charAt(bytes[i]! % USER_CODE_ALPHABET.length);
    }
    out.push(group);
  }
  return out.join("-");
}

/** Normalize a user-typed code: uppercase, strip non-alphanumerics, then re-insert dashes. */
export function normalizeUserCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== USER_CODE_GROUPS * USER_CODE_GROUP_LEN) return cleaned;
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length; i += USER_CODE_GROUP_LEN) {
    groups.push(cleaned.slice(i, i + USER_CODE_GROUP_LEN));
  }
  return groups.join("-");
}

export async function createDeviceAuthorization(
  clientMeta: ClientMeta = {},
): Promise<CreateDeviceAuthResult> {
  const id = newId("deviceAuth");
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_TTL_SECONDS * 1000);

  await db.insert(deviceAuthorizations).values({
    id,
    deviceCode,
    userCode,
    accountId: null,
    status: "pending",
    clientMeta: JSON.stringify(clientMeta),
    approvedApiKeyId: null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    approvedAt: null,
  });

  return {
    id,
    deviceCode,
    userCode,
    expiresIn: DEFAULT_TTL_SECONDS,
    interval: DEFAULT_POLL_INTERVAL_SECONDS,
  };
}

export async function findByUserCode(
  userCode: string,
): Promise<DeviceAuthorizationRow | null> {
  const normalized = normalizeUserCode(userCode);
  const row = await db
    .select()
    .from(deviceAuthorizations)
    .where(eq(deviceAuthorizations.userCode, normalized))
    .limit(1)
    .then((r) => r[0]);
  return row ?? null;
}

export async function findByDeviceCode(
  deviceCode: string,
): Promise<DeviceAuthorizationRow | null> {
  const row = await db
    .select()
    .from(deviceAuthorizations)
    .where(eq(deviceAuthorizations.deviceCode, deviceCode))
    .limit(1)
    .then((r) => r[0]);
  return row ?? null;
}

export function isExpired(row: DeviceAuthorizationRow, atIso?: string): boolean {
  const at = atIso ?? new Date().toISOString();
  return row.expiresAt <= at;
}

/** Sets status=approved and binds the row to the approving user's account_id.
 *  Does NOT mint the api_key — the next /v1/auth/token poll does that atomically. */
export async function markApproved(args: {
  deviceAuthorizationId: string;
  accountId: string;
}): Promise<void> {
  const { deviceAuthorizationId, accountId } = args;
  const now = new Date().toISOString();
  await db
    .update(deviceAuthorizations)
    .set({ status: "approved", accountId, approvedAt: now })
    .where(
      and(
        eq(deviceAuthorizations.id, deviceAuthorizationId),
        eq(deviceAuthorizations.status, "pending"),
      ),
    );
}

export async function markDenied(deviceAuthorizationId: string): Promise<void> {
  await db
    .update(deviceAuthorizations)
    .set({ status: "denied" })
    .where(eq(deviceAuthorizations.id, deviceAuthorizationId));
}

export type ConsumeResult = {
  apiKeyId: string;
  accessToken: string;
  accountId: string;
};

/**
 * Atomic claim-and-mint: if the row is `approved` and has no api_key linked yet,
 * generate the plain token, hash it into a new api_key row, link it on the
 * device_authorization, and return the plain token to the caller. Otherwise
 * returns null — the caller decides how to respond (pending, denied, expired,
 * already-issued, etc.) by re-reading the row.
 *
 * Uses an UPDATE WHERE approvedApiKeyId IS NULL guard to serialize concurrent
 * polls — only the first poll succeeds in claiming the row.
 */
export async function consumeApprovedDeviceAuth(args: {
  deviceAuthorizationId: string;
  label?: string;
}): Promise<ConsumeResult | null> {
  const candidateKeyId = newId("apiKey");
  const keyLabel = args.label?.trim() || "Authorized device";
  const token = generateApiKeyPlaintext();
  const tokenHash = sha256Hex(token);
  const tokenPreview = apiKeyPreview(token);
  const now = new Date().toISOString();

  return await db.transaction(async (tx) => {
    const claimed = await tx
      .update(deviceAuthorizations)
      .set({ approvedApiKeyId: candidateKeyId })
      .where(
        and(
          eq(deviceAuthorizations.id, args.deviceAuthorizationId),
          eq(deviceAuthorizations.status, "approved"),
          isNull(deviceAuthorizations.approvedApiKeyId),
        ),
      )
      .returning({
        id: deviceAuthorizations.id,
        accountId: deviceAuthorizations.accountId,
      });
    if (claimed.length === 0) return null;
    const claim = claimed[0]!;
    const accountId = claim.accountId;
    if (!accountId) {
      throw new Error(
        "consumeApprovedDeviceAuth: approved row has no accountId (data invariant violated)",
      );
    }

    await tx.insert(apiKeys).values({
      id: candidateKeyId,
      accountId,
      label: keyLabel,
      tokenHash,
      tokenPreview,
      createdAt: now,
    });

    return { apiKeyId: candidateKeyId, accessToken: token, accountId };
  });
}

/**
 * Mark all `pending` rows past their expires_at as `expired`.
 * Returns the number of rows updated. Safe to run repeatedly.
 */
export async function expireOldDeviceAuthorizations(): Promise<number> {
  const now = new Date().toISOString();
  const rows = await db
    .update(deviceAuthorizations)
    .set({ status: "expired" })
    .where(
      and(
        eq(deviceAuthorizations.status, "pending"),
        lt(deviceAuthorizations.expiresAt, now),
      ),
    )
    .returning({ id: deviceAuthorizations.id });
  return rows.length;
}
