import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  contacts,
  invoices,
  subscriptions,
  type BillingCycle,
  type SubscriptionStatus,
} from "../../db/schema.js";
import { newId } from "../../contract/ids.js";
import { logger } from "../../lib/logger.js";
import type { CallerContext } from "../../domain/shared.js";
import { cancelSubscription, createSubscription } from "../../domain/subscription.js";
import { createInvoice, markInvoicePaid } from "../../domain/invoice.js";
import { computeMrrCents } from "../../domain/finance-utils.js";

function normalizeCurrency(c: string | null | undefined): string {
  return (c ?? "USD").toUpperCase();
}

function unixToIso(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

function expandCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function mapStripeInterval(
  interval: "day" | "week" | "month" | "year",
  intervalCount: number,
): { billingCycle: BillingCycle; customCycleDays: number | null } {
  if (interval === "month") {
    if (intervalCount === 1) return { billingCycle: "monthly", customCycleDays: null };
    if (intervalCount === 3) return { billingCycle: "quarterly", customCycleDays: null };
    return { billingCycle: "custom_days", customCycleDays: intervalCount * 30 };
  }
  if (interval === "year") {
    if (intervalCount === 1) return { billingCycle: "yearly", customCycleDays: null };
    return { billingCycle: "custom_days", customCycleDays: intervalCount * 365 };
  }
  if (interval === "week") return { billingCycle: "custom_days", customCycleDays: intervalCount * 7 };
  return { billingCycle: "custom_days", customCycleDays: intervalCount };
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
      return "active";
    case "paused":
      return "paused";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "active";
  }
}

// ─────────────────────────────────────────────────────────── customer

export async function handleCustomerUpsert(
  ctx: CallerContext,
  stripeCustomer: Stripe.Customer | Stripe.DeletedCustomer,
): Promise<void> {
  if ("deleted" in stripeCustomer && stripeCustomer.deleted) return;
  const cust = stripeCustomer as Stripe.Customer;

  const existing = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.accountId, ctx.accountId), eq(contacts.stripeCustomerId, cust.id)),
    )
    .limit(1)
    .then((r) => r[0]);

  const now = new Date().toISOString();
  const name = cust.name?.trim() || (cust.email?.split("@")[0] ?? "Stripe customer");
  const email = cust.email ?? null;

  if (existing) {
    const namePatch = name !== existing.name;
    const emailPatch = email && email !== existing.primaryEmail;
    if (namePatch || emailPatch) {
      await db
        .update(contacts)
        .set({
          name: namePatch ? name : existing.name,
          primaryEmail: emailPatch ? email : existing.primaryEmail,
          updatedAt: now,
        })
        .where(eq(contacts.id, existing.id));
    }
    return;
  }

  // Try by email next — Stripe might have a customer we already track as a lead.
  if (email) {
    const byEmail = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.accountId, ctx.accountId), eq(contacts.primaryEmail, email)))
      .limit(1)
      .then((r) => r[0]);
    if (byEmail) {
      await db
        .update(contacts)
        .set({ stripeCustomerId: cust.id, updatedAt: now })
        .where(eq(contacts.id, byEmail.id));
      return;
    }
  }

  // No match — create a fresh contact mirroring Stripe.
  await db.insert(contacts).values({
    id: newId("contact"),
    accountId: ctx.accountId,
    name,
    primaryEmail: email,
    status: "customer",
    stripeCustomerId: cust.id,
    createdAt: now,
    updatedAt: now,
  });
}

// ─────────────────────────────────────────────────────────── subscription

async function findContactByStripeCustomerId(
  ctx: CallerContext,
  stripeCustomerId: string,
): Promise<{ id: string } | undefined> {
  return db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, ctx.accountId),
        eq(contacts.stripeCustomerId, stripeCustomerId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
}

export async function handleSubscriptionUpsert(
  ctx: CallerContext,
  stripeSub: Stripe.Subscription,
): Promise<void> {
  const firstItem = stripeSub.items.data[0];
  if (!firstItem) {
    logger.warn(
      { subId: stripeSub.id, accountId: ctx.accountId },
      "stripe subscription has no items; skipping",
    );
    return;
  }
  const price = firstItem.price;
  const unitAmount = price.unit_amount ?? 0;
  const quantity = firstItem.quantity ?? 1;
  const amountCents = unitAmount * quantity;
  const currency = normalizeCurrency(price.currency);
  const status = mapStripeStatus(stripeSub.status);

  let billingCycle: BillingCycle = "monthly";
  let customCycleDays: number | null = null;
  if (price.recurring) {
    const mapped = mapStripeInterval(price.recurring.interval, price.recurring.interval_count);
    billingCycle = mapped.billingCycle;
    customCycleDays = mapped.customCycleDays;
  }

  const existing = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, ctx.accountId),
        eq(subscriptions.stripeSubscriptionId, stripeSub.id),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  const mrrCents = computeMrrCents(amountCents, billingCycle, customCycleDays);

  if (existing) {
    // Bypass updateSubscription's "active-only" guard so we can also flip a
    // canceled-in-Stripe sub to canceled here even if its krabs status is stale.
    const now = new Date().toISOString();
    await db
      .update(subscriptions)
      .set({
        amountCents,
        currency,
        billingCycle,
        customCycleDays,
        mrrCents,
        status,
        canceledAt:
          status === "canceled"
            ? (existing.canceledAt ?? unixToIso(stripeSub.canceled_at) ?? now)
            : existing.canceledAt,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing.id));
    return;
  }

  const customerId = expandCustomerId(stripeSub.customer);
  if (!customerId) {
    logger.warn({ subId: stripeSub.id }, "stripe subscription has no customer; skipping");
    return;
  }
  const contact = await findContactByStripeCustomerId(ctx, customerId);
  if (!contact) {
    logger.warn(
      { subId: stripeSub.id, stripeCustomerId: customerId, accountId: ctx.accountId },
      "no contact found for stripe subscription; skipping (customer.created should arrive first)",
    );
    return;
  }

  const startedAt = unixToIso(stripeSub.start_date) ?? new Date().toISOString();
  await createSubscription(
    ctx,
    {
      contactId: contact.id,
      amountCents,
      currency,
      billingCycle,
      ...(customCycleDays !== null ? { customCycleDays } : {}),
      status,
      startedAt,
      stripeSubscriptionId: stripeSub.id,
    },
    {
      intent: `stripe:${stripeSub.id}`,
      // Idempotency key keyed by stripe sub id — re-delivery of the create event
      // for the same sub returns the cached row instead of inserting twice.
      idempotencyKey: `stripe-sub-create:${stripeSub.id}`,
    },
  );
}

export async function handleSubscriptionCanceled(
  ctx: CallerContext,
  stripeSub: Stripe.Subscription,
): Promise<void> {
  const existing = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, ctx.accountId),
        eq(subscriptions.stripeSubscriptionId, stripeSub.id),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!existing) {
    logger.warn(
      { subId: stripeSub.id, accountId: ctx.accountId },
      "subscription.deleted for unknown sub; skipping",
    );
    return;
  }
  if (existing.status === "canceled" || existing.status === "expired") return;
  try {
    await cancelSubscription(ctx, existing.id, { reason: "stripe" });
  } catch (err) {
    // The existing cancelSubscription throws if already terminal; we swallow
    // because the webhook is the source of truth here.
    logger.warn(
      { subId: stripeSub.id, err: err instanceof Error ? err.message : String(err) },
      "cancelSubscription rejected stripe-driven cancel",
    );
  }
}

// ─────────────────────────────────────────────────────────── invoice

function extractSubscriptionId(
  inv: Stripe.Invoice,
): string | null {
  // In recent Stripe API versions invoice.subscription was removed in favor of
  // invoice.parent.subscription_details.subscription. Check both for safety.
  // Cast through unknown because the field shape varies by api version.
  const root = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (typeof root === "string") return root;
  if (root && typeof root === "object" && "id" in root) return root.id;
  const parent = (inv as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  }).parent;
  const subRef = parent?.subscription_details?.subscription ?? null;
  if (typeof subRef === "string") return subRef;
  if (subRef && typeof subRef === "object" && "id" in subRef) return subRef.id;
  return null;
}

export async function handleInvoicePaid(
  ctx: CallerContext,
  stripeInvoice: Stripe.Invoice,
): Promise<void> {
  const existing = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.accountId, ctx.accountId), eq(invoices.stripeInvoiceId, stripeInvoice.id!)),
    )
    .limit(1)
    .then((r) => r[0]);

  const paidAt =
    unixToIso(stripeInvoice.status_transitions?.paid_at) ?? new Date().toISOString();

  if (existing) {
    if (existing.status === "paid") return;
    if (existing.status === "draft" || existing.status === "sent" || existing.status === "overdue") {
      // markInvoicePaid only accepts sent|overdue; if draft, flip directly.
      if (existing.status === "draft") {
        await db
          .update(invoices)
          .set({ status: "paid", paidAt, updatedAt: new Date().toISOString() })
          .where(eq(invoices.id, existing.id));
        return;
      }
      await markInvoicePaid(ctx, existing.id, { paidAt });
      return;
    }
    logger.warn(
      { invoiceId: existing.id, status: existing.status },
      "invoice.paid received for invoice in non-payable status; skipping",
    );
    return;
  }

  const customerId = expandCustomerId(stripeInvoice.customer);
  if (!customerId) {
    logger.warn({ stripeInvoiceId: stripeInvoice.id }, "invoice.paid with no customer; skipping");
    return;
  }
  const contact = await findContactByStripeCustomerId(ctx, customerId);
  if (!contact) {
    logger.warn(
      { stripeInvoiceId: stripeInvoice.id, stripeCustomerId: customerId },
      "no contact for stripe invoice; skipping",
    );
    return;
  }

  const subRefId = extractSubscriptionId(stripeInvoice);
  let krabsSubscriptionId: string | undefined;
  if (subRefId) {
    const subRow = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.accountId, ctx.accountId),
          eq(subscriptions.stripeSubscriptionId, subRefId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);
    if (subRow) krabsSubscriptionId = subRow.id;
  }

  const issuedAt = unixToIso(stripeInvoice.created) ?? new Date().toISOString();
  const dueAt = unixToIso(stripeInvoice.due_date);

  const created = await createInvoice(
    ctx,
    {
      contactId: contact.id,
      ...(krabsSubscriptionId ? { subscriptionId: krabsSubscriptionId } : {}),
      amountCents: stripeInvoice.amount_paid,
      currency: normalizeCurrency(stripeInvoice.currency),
      issuedAt,
      ...(dueAt ? { dueAt } : {}),
      stripeInvoiceId: stripeInvoice.id!,
    },
    {
      intent: `stripe:${stripeInvoice.id}`,
      idempotencyKey: `stripe-invoice-create:${stripeInvoice.id}`,
    },
  );

  // The new row starts as draft; immediately flip to paid (draft can't go
  // through markInvoicePaid's sent|overdue guard, so we patch directly).
  await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invoices.id, created.invoice.id));
}

export async function handleInvoiceFailed(
  ctx: CallerContext,
  stripeInvoice: Stripe.Invoice,
): Promise<void> {
  const existing = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.accountId, ctx.accountId), eq(invoices.stripeInvoiceId, stripeInvoice.id!)),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!existing) {
    logger.info(
      { stripeInvoiceId: stripeInvoice.id, accountId: ctx.accountId },
      "invoice.payment_failed for unmirrored invoice; skipping",
    );
    return;
  }
  if (existing.status === "paid" || existing.status === "void" || existing.status === "refunded") {
    return;
  }
  await db
    .update(invoices)
    .set({ status: "overdue", updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, existing.id));
}

// ─────────────────────────────────────────────────────────── charge

export async function handleChargeRefunded(
  ctx: CallerContext,
  stripeCharge: Stripe.Charge,
): Promise<void> {
  const existing = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.accountId, ctx.accountId), eq(invoices.stripeChargeId, stripeCharge.id)),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!existing) {
    logger.info(
      { chargeId: stripeCharge.id, accountId: ctx.accountId },
      "charge.refunded for unmirrored charge; skipping",
    );
    return;
  }
  const fullyRefunded =
    stripeCharge.refunded === true || stripeCharge.amount_refunded >= stripeCharge.amount;
  const partial = !fullyRefunded;
  const noteLines: string[] = [];
  if (existing.note) noteLines.push(existing.note);
  noteLines.push(
    partial
      ? `Stripe partial refund: ${stripeCharge.amount_refunded} / ${stripeCharge.amount} ${normalizeCurrency(stripeCharge.currency)}`
      : `Stripe full refund: ${stripeCharge.amount_refunded} ${normalizeCurrency(stripeCharge.currency)}`,
  );

  await db
    .update(invoices)
    .set({
      status: "refunded",
      note: noteLines.join("\n"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invoices.id, existing.id));
}
