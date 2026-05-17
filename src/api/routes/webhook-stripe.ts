import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { integrations } from "../../db/schema.js";
import { ApiError } from "../../contract/errors.js";
import { logger } from "../../lib/logger.js";
import {
  decryptWebhookSecret,
  processStripeEvent,
  verifyAndParseEvent,
} from "../../integrations/stripe/events.js";
import type { CallerContext } from "../../domain/shared.js";

export const webhookStripeRoute = new Hono();

webhookStripeRoute.post("/:accountId/webhook", async (c) => {
  const accountId = c.req.param("accountId");

  // Read the raw body BEFORE any parsing — Stripe's signature is computed over
  // the exact bytes sent. Parsing JSON first would defeat verification on any
  // payload where field order or whitespace differs from what Stripe signed.
  const rawBody = await c.req.text();
  const signatureHeader = c.req.header("stripe-signature") ?? c.req.header("Stripe-Signature");

  // Generic "invalid signature" error reused for every pre-verification failure
  // (missing header, unknown accountId, inactive integration, bad signature).
  // Keeping these indistinguishable prevents an unauthenticated caller from
  // enumerating which accountIds have an active Stripe integration.
  const invalidSig = new ApiError({
    code: "VALIDATION_FAILED",
    message: "Invalid Stripe webhook signature",
  });

  if (!signatureHeader) {
    logger.warn({ accountId }, "stripe webhook: missing signature header");
    throw invalidSig;
  }

  const integration = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.accountId, accountId),
        eq(integrations.provider, "stripe"),
        eq(integrations.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!integration) {
    logger.warn({ accountId }, "stripe webhook: no active integration for account");
    throw invalidSig;
  }

  const whsec = decryptWebhookSecret(integration);
  const event = verifyAndParseEvent(rawBody, signatureHeader, whsec);

  // apiKeyId on the audit row is the integration id — this lets `audit_actions`
  // attribute the change to the stripe integration rather than a user key.
  const ctx: CallerContext = {
    accountId: integration.accountId,
    apiKeyId: integration.id,
  };

  try {
    await processStripeEvent(ctx, integration, event);
  } catch (err) {
    // The event row is persisted before dispatch; we've recorded the failure
    // there with retries+errorMessage. Returning 200 keeps Stripe from spamming
    // retries for a handler bug we can replay manually.
    logger.error(
      {
        accountId,
        integrationId: integration.id,
        stripeEventId: event.id,
        type: event.type,
        err: err instanceof Error ? err.message : String(err),
      },
      "stripe webhook handler error after persist; returning 200",
    );
  }

  return c.json({ received: true });
});
