import { Hono } from "hono";
import Stripe from "stripe";
import { db } from "../../db/client.js";
import { accounts, apiKeys } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { createInvoice } from "../../domain/invoice.js";
import { createSubscription, cancelSubscription } from "../../domain/subscription.js";
import type { CallerContext } from "../../domain/shared.js";

export const webhookStripeRoute = new Hono();

async function getSystemCtx(): Promise<CallerContext> {
  const row = await db.select({ id: accounts.id }).from(accounts).limit(1).then((r) => r[0]);
  if (!row) throw new Error("No account found — run pnpm setup first");
  // Use the first API key for the account as the actor (self-host: there's only one account)
  const keyRow = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.accountId, row.id))
    .limit(1)
    .then((r) => r[0]);
  if (!keyRow) throw new Error("No API key found — run pnpm setup first");
  return { accountId: row.id, apiKeyId: keyRow.id };
}

webhookStripeRoute.post("/", async (c) => {
  const webhookSecret = process.env.KRABS_STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return c.json({ error: { code: "NOT_CONFIGURED", message: "Stripe webhook not configured. Set KRABS_STRIPE_WEBHOOK_SECRET." }, _schema_version: "1" }, 503);
  }

  const rawBody = await c.req.raw.text();
  const sig = c.req.header("stripe-signature") ?? "";

  let event: Stripe.Event;

  // In test mode skip signature verification when KRABS_STRIPE_SKIP_SIG=true
  if (process.env.KRABS_STRIPE_SKIP_SIG === "true") {
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return c.json({ error: { code: "INVALID_PAYLOAD", message: "Invalid JSON" }, _schema_version: "1" }, 400);
    }
  } else {
    try {
      event = Stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signature verification failed";
      return c.json({ error: { code: "INVALID_SIGNATURE", message: msg }, _schema_version: "1" }, 400);
    }
  }

  const ctx = await getSystemCtx();

  if (event.type === "invoice.paid") {
    const stripeInvoice = event.data.object as Stripe.Invoice;
    const description =
      stripeInvoice.description ??
      (stripeInvoice.metadata && stripeInvoice.metadata["description"]) ??
      `Stripe invoice ${stripeInvoice.id}`;
    const counterparty =
      stripeInvoice.customer_name ??
      stripeInvoice.customer_email ??
      undefined;

    await createInvoice(ctx, {
      amountCents: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency.toUpperCase(),
      counterparty: counterparty ?? undefined,
      note: description,
      issuedAt: stripeInvoice.status_transitions?.paid_at
        ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
        : undefined,
    });

    return c.json({ ok: true }, 200);
  }

  if (event.type === "customer.subscription.created") {
    const stripeSub = event.data.object as Stripe.Subscription;
    const plan = stripeSub.items.data[0]?.plan;
    const interval = plan?.interval === "year" ? "yearly" : "monthly";
    const amountCents = plan?.amount ?? 0;
    const currency = (plan?.currency ?? "usd").toUpperCase();
    const name =
      stripeSub.description ??
      (stripeSub.metadata && stripeSub.metadata["name"]) ??
      `Stripe subscription ${stripeSub.id}`;

    await createSubscription(ctx, {
      amountCents,
      currency,
      billingCycle: interval,
      counterparty: name,
      startedAt: new Date(stripeSub.start_date * 1000).toISOString(),
    });

    return c.json({ ok: true }, 200);
  }

  if (event.type === "customer.subscription.deleted") {
    const stripeSub = event.data.object as Stripe.Subscription;
    // Find matching subscription by stripe ID stored in note/counterparty — best effort by metadata.
    // Since we don't store stripe_id, we cancel via the event metadata stripeSubId if stored,
    // otherwise we log and ack (idempotent no-op for unknown subs).
    const stripeSubId = stripeSub.id;
    const { subscriptions } = await import("../../db/schema.js");
    const { and, like } = await import("drizzle-orm");
    // Find subscription whose counterparty matches the stripe sub name pattern
    const rows = await db
      .select({ id: subscriptions.id, accountId: subscriptions.accountId })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.accountId, ctx.accountId),
          like(subscriptions.counterparty, `%${stripeSubId}%`),
        ),
      )
      .limit(1);

    if (rows[0]) {
      await cancelSubscription(ctx, rows[0].id, { reason: "Stripe subscription deleted" });
    }
    // Ack regardless — if no match, nothing to cancel
    return c.json({ ok: true }, 200);
  }

  // Unknown event type — ack to prevent Stripe retries
  return c.json({ ok: true, ignored: true }, 200);
});
