import Stripe from "stripe";
import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { stripeEvents, type IntegrationRow } from "../../db/schema.js";
import { ApiError } from "../../contract/errors.js";
import { logger } from "../../lib/logger.js";
import type { CallerContext } from "../../domain/shared.js";
import { decryptSecret } from "../../lib/encryption.js";
import {
  handleCustomerUpsert,
  handleSubscriptionUpsert,
  handleSubscriptionCanceled,
  handleInvoicePaid,
  handleInvoiceFailed,
  handleChargeRefunded,
} from "./handlers.js";

export const STRIPE_WEBHOOK_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "customer.created",
  "customer.updated",
] as const;

export type StripeWebhookEvent = (typeof STRIPE_WEBHOOK_EVENTS)[number];

export function verifyAndParseEvent(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Stripe.Event {
  try {
    // The webhooks helper is static; no secret key needed to verify a signature.
    return Stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Invalid Stripe webhook signature",
      hint: msg,
    });
  }
}

export type ProcessStripeEventResult = {
  processed: boolean;
  replayed: boolean;
  type: string;
};

export async function processStripeEvent(
  ctx: CallerContext,
  integration: IntegrationRow,
  event: Stripe.Event,
): Promise<ProcessStripeEventResult> {
  const now = new Date().toISOString();
  // ON CONFLICT DO NOTHING dedups by Stripe's evt_ id. We then check whether
  // the row was already processed; an unprocessed row left by a crashed prior
  // attempt is retried (Stripe redelivers, but we also want a manual replay
  // tool to be able to flip processed_at back to null).
  const inserted = await db
    .insert(stripeEvents)
    .values({
      id: event.id,
      accountId: ctx.accountId,
      integrationId: integration.id,
      type: event.type,
      receivedAt: now,
      payload: JSON.stringify(event),
    })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });

  if (inserted.length === 0) {
    const existing = await db.query.stripeEvents.findFirst({
      where: (e, { eq }) => eq(e.id, event.id),
    });
    if (existing?.processedAt) {
      return { processed: false, replayed: true, type: event.type };
    }
  }

  try {
    await dispatch(ctx, event);
    await db
      .update(stripeEvents)
      .set({ processedAt: new Date().toISOString(), errorMessage: null })
      .where(sql`${stripeEvents.id} = ${event.id}`);
    logger.info(
      { stripeEventId: event.id, type: event.type, accountId: ctx.accountId },
      "stripe event processed",
    );
    return { processed: true, replayed: false, type: event.type };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(stripeEvents)
      .set({ errorMessage: msg.slice(0, 1000), retries: sql`${stripeEvents.retries} + 1` })
      .where(sql`${stripeEvents.id} = ${event.id}`);
    logger.error(
      { stripeEventId: event.id, type: event.type, accountId: ctx.accountId, err: msg },
      "stripe event processing failed",
    );
    throw err;
  }
}

async function dispatch(ctx: CallerContext, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.created":
    case "customer.updated":
      await handleCustomerUpsert(ctx, event.data.object);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(ctx, event.data.object);
      return;
    case "customer.subscription.deleted":
      await handleSubscriptionCanceled(ctx, event.data.object);
      return;
    case "invoice.paid":
      await handleInvoicePaid(ctx, event.data.object);
      return;
    case "invoice.payment_failed":
      await handleInvoiceFailed(ctx, event.data.object);
      return;
    case "charge.refunded":
      await handleChargeRefunded(ctx, event.data.object);
      return;
    default:
      logger.info(
        { stripeEventId: event.id, type: event.type, accountId: ctx.accountId },
        "stripe event ignored (not in subscription set)",
      );
  }
}

// Re-exported so callers can decrypt the webhook secret in a single place.
export function decryptWebhookSecret(integration: IntegrationRow): string {
  if (!integration.webhookSecretEncrypted) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Integration has no webhook secret on file",
      hint: "Reconnect Stripe to provision a new webhook endpoint",
    });
  }
  return decryptSecret(integration.webhookSecretEncrypted);
}
