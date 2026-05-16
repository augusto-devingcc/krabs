import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { agentActions, integrations, type IntegrationRow } from "../../db/schema.js";
import { newId } from "../../contract/ids.js";
import { ApiError } from "../../contract/errors.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/encryption.js";
import { logger } from "../../lib/logger.js";
import { buildAction, type CallerContext } from "../../domain/shared.js";
import { getStripeClient } from "./client.js";
import { STRIPE_WEBHOOK_EVENTS } from "./events.js";

export const connectStripeInputSchema = z.object({
  // Restricted API Key (rk_...) or full secret (sk_...). We don't restrict the
  // prefix because Stripe's restricted keys come in test (rk_test_...) and
  // live (rk_live_...) forms and self-hosters may legitimately use a full sk_.
  secretKey: z.string().min(10).max(255),
  displayName: z.string().trim().min(1).max(100),
});

export type ConnectStripeInput = z.input<typeof connectStripeInputSchema>;

export type StripeIntegrationSummary = {
  id: string;
  accountId: string;
  provider: "stripe";
  displayName: string;
  status: IntegrationRow["status"];
  providerAccountId: string | null;
  webhookEndpointId: string | null;
  maskedSecret: string;
  lastSyncedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectStripeResult = {
  integration: StripeIntegrationSummary;
  agentActionId: string;
};

export type DisconnectStripeResult = {
  disconnected: boolean;
  integration: StripeIntegrationSummary | null;
  agentActionId: string | null;
};

export type StripeStatus =
  | { connected: false }
  | {
      connected: true;
      displayName: string;
      providerAccountId: string | null;
      status: IntegrationRow["status"];
      lastSyncedAt: string | null;
      lastErrorMessage: string | null;
      maskedSecret: string;
    };

function getPublicAppUrl(): string {
  // KRABS_PUBLIC_URL is preferred (set in cloud + self-host). Fall back to the
  // CLI/agent convention KRABS_API_URL so we don't ask self-hosters to set two
  // env vars for the same thing. Default keeps connect callable in tests.
  return (
    process.env.KRABS_PUBLIC_URL ??
    process.env.KRABS_API_URL ??
    "https://api.krabs.dev"
  ).replace(/\/+$/, "");
}

function webhookUrlFor(accountId: string): string {
  return `${getPublicAppUrl()}/v1/integrations/stripe/${accountId}/webhook`;
}

function rowToSummary(row: IntegrationRow): StripeIntegrationSummary {
  return {
    id: row.id,
    accountId: row.accountId,
    provider: "stripe",
    displayName: row.displayName,
    status: row.status,
    providerAccountId: row.providerAccountId,
    webhookEndpointId: row.webhookEndpointId,
    maskedSecret: maskSecret(decryptSecret(row.secretKeyEncrypted), 4),
    lastSyncedAt: row.lastSyncedAt,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getActiveIntegration(ctx: CallerContext): Promise<IntegrationRow | undefined> {
  return db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.accountId, ctx.accountId),
        eq(integrations.provider, "stripe"),
        eq(integrations.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
}

export async function getStripeIntegrationRow(
  ctx: CallerContext,
): Promise<IntegrationRow | undefined> {
  return db
    .select()
    .from(integrations)
    .where(and(eq(integrations.accountId, ctx.accountId), eq(integrations.provider, "stripe")))
    .limit(1)
    .then((r) => r[0]);
}

export async function connectStripe(
  ctx: CallerContext,
  input: ConnectStripeInput,
): Promise<ConnectStripeResult> {
  const parsed = connectStripeInputSchema.parse(input);

  const existingActive = await getActiveIntegration(ctx);
  if (existingActive) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Stripe is already connected to this account",
      hint: "Disconnect first, then reconnect with the new key",
    });
  }

  const stripe = getStripeClient(parsed.secretKey);

  // Validate by calling Balance — cheapest authenticated read that requires
  // a working key with at least 1 read scope. StripeAuthenticationError =
  // bad/revoked key; StripePermissionError = scopes too narrow.
  try {
    await stripe.balance.retrieve();
  } catch (err) {
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      throw new ApiError({
        code: "VALIDATION_FAILED",
        message: "Stripe rejected the API key",
        hint: "Make sure the key is active and has at least one read permission",
      });
    }
    if (err instanceof Stripe.errors.StripePermissionError) {
      throw new ApiError({
        code: "VALIDATION_FAILED",
        message: "Stripe key is valid but lacks required permissions",
        hint: "Grant read access to Customers, Charges, Invoices, Subscriptions, Products, Prices, Refunds; write access to Webhook Endpoints",
      });
    }
    throw err;
  }

  // The stripe account id requires `account` read permission, which restricted
  // keys may or may not have. We attempt and silently fall back to null —
  // this is purely informational for the dashboard.
  let providerAccountId: string | null = null;
  try {
    const account = await stripe.accounts.retrieveCurrent();
    providerAccountId = account.id ?? null;
  } catch (err) {
    logger.info(
      { accountId: ctx.accountId, err: err instanceof Error ? err.message : String(err) },
      "stripe accounts.retrieve failed; provider_account_id will be null",
    );
  }

  // Create the webhook endpoint on the user's Stripe. The returned secret
  // (whsec_...) is only shown once — we encrypt and stash it immediately.
  let webhookEndpoint: Stripe.WebhookEndpoint;
  try {
    webhookEndpoint = await stripe.webhookEndpoints.create({
      url: webhookUrlFor(ctx.accountId),
      enabled_events: [...STRIPE_WEBHOOK_EVENTS],
      description: "krabs.dev",
    });
  } catch (err) {
    if (err instanceof Stripe.errors.StripePermissionError) {
      throw new ApiError({
        code: "VALIDATION_FAILED",
        message: "Stripe key cannot create webhooks",
        hint: "Grant 'Webhook Endpoints: Write' permission on the restricted key",
      });
    }
    throw err;
  }
  if (!webhookEndpoint.secret) {
    // Shouldn't happen on a freshly-created endpoint; bail loudly so we don't
    // store an unverifiable integration.
    throw new ApiError({
      code: "INTERNAL",
      message: "Stripe did not return a webhook secret",
      hint: "Retry; if persistent, contact support",
    });
  }

  const now = new Date().toISOString();
  const integrationId = newId("integration");
  const actionId = newId("agentAction");
  const row: IntegrationRow = {
    id: integrationId,
    accountId: ctx.accountId,
    provider: "stripe",
    displayName: parsed.displayName,
    secretKeyEncrypted: encryptSecret(parsed.secretKey),
    webhookSecretEncrypted: encryptSecret(webhookEndpoint.secret),
    webhookEndpointId: webhookEndpoint.id,
    providerAccountId,
    status: "active",
    lastSyncedAt: now,
    lastErrorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(async (tx) => {
    await tx.insert(integrations).values(row);
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "integration.connect",
        targetKind: "integration",
        targetId: integrationId,
        metadata: {
          provider: "stripe",
          displayName: parsed.displayName,
          webhookEndpointId: webhookEndpoint.id,
          providerAccountId,
        },
        createdAt: now,
      }),
      id: actionId,
    });
  });

  logger.info(
    {
      accountId: ctx.accountId,
      integrationId,
      webhookEndpointId: webhookEndpoint.id,
      providerAccountId,
    },
    "stripe integration connected",
  );

  return { integration: rowToSummary(row), agentActionId: actionId };
}

export async function disconnectStripe(ctx: CallerContext): Promise<DisconnectStripeResult> {
  const row = await getActiveIntegration(ctx);
  if (!row) return { disconnected: false, integration: null, agentActionId: null };

  // Best-effort tear down on the Stripe side. If the key has been revoked or
  // the endpoint already removed, we still want our row marked disconnected.
  if (row.webhookEndpointId) {
    try {
      const stripe = getStripeClient(decryptSecret(row.secretKeyEncrypted));
      await stripe.webhookEndpoints.del(row.webhookEndpointId);
    } catch (err) {
      logger.warn(
        {
          accountId: ctx.accountId,
          webhookEndpointId: row.webhookEndpointId,
          err: err instanceof Error ? err.message : String(err),
        },
        "failed to delete stripe webhook endpoint; proceeding with local disconnect",
      );
    }
  }

  const now = new Date().toISOString();
  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(integrations)
      .set({
        status: "disconnected",
        webhookEndpointId: null,
        updatedAt: now,
      })
      .where(eq(integrations.id, row.id));
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "integration.disconnect",
        targetKind: "integration",
        targetId: row.id,
        metadata: { provider: "stripe", priorWebhookEndpointId: row.webhookEndpointId },
        createdAt: now,
      }),
      id: actionId,
    });
  });

  const updated: IntegrationRow = {
    ...row,
    status: "disconnected",
    webhookEndpointId: null,
    updatedAt: now,
  };
  return { disconnected: true, integration: rowToSummary(updated), agentActionId: actionId };
}

export async function getStripeStatus(ctx: CallerContext): Promise<StripeStatus> {
  const row = await getStripeIntegrationRow(ctx);
  if (!row) return { connected: false };
  if (row.status !== "active") {
    return {
      connected: false,
    };
  }
  return {
    connected: true,
    displayName: row.displayName,
    providerAccountId: row.providerAccountId,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt,
    lastErrorMessage: row.lastErrorMessage,
    maskedSecret: maskSecret(decryptSecret(row.secretKeyEncrypted), 4),
  };
}
