import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { accounts, apiKeys } from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } from "../lib/hash.js";

export type ResolvedAccount = {
  id: string;
  email: string;
  name: string | null;
  clerkUserId: string | null;
  dashboardApiKeyId: string;
  /** Only present when the dashboard key was JUST created (first signup). */
  dashboardApiKeyPlaintext?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Find-or-create an account for a Clerk user. Also guarantees that a
 * "Web Dashboard" API key exists — the web UI uses it as the actor for
 * every mutation, so the audit log records actions consistently
 * regardless of whether they came from the agent, the CLI, or the UI.
 */
export async function resolveAccountForClerkUser(args: {
  clerkUserId: string;
  email: string;
  name?: string | null;
}): Promise<ResolvedAccount> {
  const byClerk = await db
    .select()
    .from(accounts)
    .where(eq(accounts.clerkUserId, args.clerkUserId))
    .limit(1)
    .then((r) => r[0]);
  if (byClerk) {
    const dashboardKey = await ensureDashboardKey(byClerk.id);
    return {
      id: byClerk.id,
      email: byClerk.email,
      name: byClerk.name,
      clerkUserId: byClerk.clerkUserId,
      dashboardApiKeyId: dashboardKey.id,
      createdAt: byClerk.createdAt,
      updatedAt: byClerk.updatedAt,
      ...(dashboardKey.plaintext ? { dashboardApiKeyPlaintext: dashboardKey.plaintext } : {}),
    };
  }

  // Try to claim an existing account by email (e.g. the seeded one)
  const byEmail = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, args.email))
    .limit(1)
    .then((r) => r[0]);
  if (byEmail) {
    await db
      .update(accounts)
      .set({ clerkUserId: args.clerkUserId, name: args.name ?? byEmail.name })
      .where(eq(accounts.id, byEmail.id));
    const dashboardKey = await ensureDashboardKey(byEmail.id);
    return {
      id: byEmail.id,
      email: byEmail.email,
      name: args.name ?? byEmail.name,
      clerkUserId: args.clerkUserId,
      dashboardApiKeyId: dashboardKey.id,
      createdAt: byEmail.createdAt,
      updatedAt: byEmail.updatedAt,
      ...(dashboardKey.plaintext ? { dashboardApiKeyPlaintext: dashboardKey.plaintext } : {}),
    };
  }

  const id = newId("account");
  const now = new Date().toISOString();
  await db.insert(accounts).values({
    id,
    email: args.email,
    name: args.name ?? null,
    clerkUserId: args.clerkUserId,
    createdAt: now,
    updatedAt: now,
  });
  const dashboardKey = await ensureDashboardKey(id);
  return {
    id,
    email: args.email,
    name: args.name ?? null,
    clerkUserId: args.clerkUserId,
    dashboardApiKeyId: dashboardKey.id,
    createdAt: now,
    updatedAt: now,
    ...(dashboardKey.plaintext ? { dashboardApiKeyPlaintext: dashboardKey.plaintext } : {}),
  };
}

const DASHBOARD_KEY_LABEL = "Web Dashboard";

async function ensureDashboardKey(
  accountId: string,
): Promise<{ id: string; plaintext?: string }> {
  const existing = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.accountId, accountId), eq(apiKeys.label, DASHBOARD_KEY_LABEL)))
    .then((rows) => rows[0]);
  if (existing) return { id: existing.id };

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
