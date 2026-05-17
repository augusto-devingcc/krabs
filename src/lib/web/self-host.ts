import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { accounts, apiKeys } from "../../db/schema.js";
import { newId } from "../../contract/ids.js";
import { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } from "../../lib/hash.js";
import type { ResolvedAccount } from "../../domain/clerk-sync.js";

/**
 * Self-host mode: Clerk is not configured. The dashboard runs against a
 * single local account — the one `pnpm setup` (or `pnpm kickoff`) created.
 * Anyone with filesystem access to the host is implicitly the operator;
 * the threat model is "my own machine", not "multi-tenant SaaS".
 */
export function isSelfHostMode(): boolean {
  return !process.env.CLERK_SECRET_KEY;
}

const DASHBOARD_KEY_LABEL = "Web Dashboard";

/**
 * Resolve the single local-operator account. Prefers an account that has no
 * Clerk linkage (the one created by `pnpm setup`); falls back to the
 * earliest-created account if none is unlinked. Provisions a dashboard
 * API key if missing so audit rows still have a non-null apiKeyId.
 */
export async function resolveSelfHostAccount(): Promise<ResolvedAccount> {
  // Prefer the account `pnpm setup` created (clerk_user_id IS NULL). If
  // someone connected Clerk later that row would have a clerkUserId — but
  // in that case Clerk would be enabled and we wouldn't be on this path.
  const unlinked = await db
    .select()
    .from(accounts)
    .where(isNull(accounts.clerkUserId))
    .orderBy(accounts.createdAt)
    .limit(1)
    .then((r) => r[0]);

  const row =
    unlinked ??
    (await db
      .select()
      .from(accounts)
      .orderBy(accounts.createdAt)
      .limit(1)
      .then((r) => r[0]));

  if (!row) {
    throw new SelfHostNotInitializedError();
  }

  const key = await ensureSelfHostDashboardKey(row.id);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    clerkUserId: row.clerkUserId,
    dashboardApiKeyId: key.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(key.plaintext ? { dashboardApiKeyPlaintext: key.plaintext } : {}),
  };
}

async function ensureSelfHostDashboardKey(
  accountId: string,
): Promise<{ id: string; plaintext?: string }> {
  const existing = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.accountId, accountId), eq(apiKeys.label, DASHBOARD_KEY_LABEL)))
    .then((rows) => rows[0]);
  if (existing) return { id: existing.id };

  // Reuse the setup-created key if present (label "Local operator key").
  const setupKey = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.accountId, accountId))
    .orderBy(apiKeys.createdAt)
    .limit(1)
    .then((rows) => rows[0]);
  if (setupKey) return { id: setupKey.id };

  const id = newId("apiKey");
  const plaintext = generateApiKeyPlaintext();
  await db.insert(apiKeys).values({
    id,
    accountId,
    label: DASHBOARD_KEY_LABEL,
    tokenHash: sha256Hex(plaintext),
    tokenPreview: apiKeyPreview(plaintext),
  });
  return { id, plaintext };
}

export class SelfHostNotInitializedError extends Error {
  constructor() {
    super(
      "Self-host mode active but no account exists. Run `pnpm setup` (or `pnpm kickoff`) first.",
    );
    this.name = "SelfHostNotInitializedError";
  }
}
