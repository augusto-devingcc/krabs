import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  agentActions,
  contacts,
  products,
  subscriptions,
  billingCycles,
  subscriptionStatuses,
  type SubscriptionRow,
  type SubscriptionStatus,
  type BillingCycle,
} from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { idSchema } from "../contract/ids.js";
import { ApiError } from "../contract/errors.js";
import { computeMrrCents, computePeriodEnd } from "./finance-utils.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export const subscriptionCreateInputSchema = z
  .object({
    contactId: idSchema("contact"),
    productId: idSchema("product").optional(),
    amountCents: z.number().int().min(0),
    currency: z.string().length(3).default("USD"),
    billingCycle: z.enum(billingCycles),
    customCycleDays: z.number().int().positive().optional(),
    status: z.enum(subscriptionStatuses).default("active"),
    startedAt: z.string().datetime().optional(),
    customFields: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.billingCycle === "custom_days" && !val.customCycleDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customCycleDays"],
        message: "customCycleDays is required when billingCycle is custom_days",
      });
    }
  });

export const subscriptionUpdateInputSchema = z.object({
  productId: idSchema("product").nullable().optional(),
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  billingCycle: z.enum(billingCycles).optional(),
  customCycleDays: z.number().int().positive().nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

export const subscriptionListFiltersSchema = z.object({
  status: z.enum(subscriptionStatuses).optional(),
  contactId: idSchema("contact").optional(),
  productId: idSchema("product").optional(),
});

export const cancelSubscriptionInputSchema = z.object({
  reason: z.string().max(500).optional(),
  cancelAt: z.string().datetime().nullable().optional(),
});

export type SubscriptionCreateInput = z.input<typeof subscriptionCreateInputSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateInputSchema>;
export type SubscriptionListFilters = z.infer<typeof subscriptionListFiltersSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionInputSchema>;

export type Subscription = {
  id: string;
  accountId: string;
  contactId: string;
  productId: string | null;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  customCycleDays: number | null;
  mrrCents: number;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
  cancelAt: string | null;
  cancelReason: string | null;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    accountId: row.accountId,
    contactId: row.contactId,
    productId: row.productId,
    amountCents: row.amountCents,
    currency: row.currency,
    billingCycle: row.billingCycle as BillingCycle,
    customCycleDays: row.customCycleDays,
    mrrCents: row.mrrCents,
    status: row.status as SubscriptionStatus,
    startedAt: row.startedAt,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    canceledAt: row.canceledAt,
    cancelAt: row.cancelAt,
    cancelReason: row.cancelReason,
    customFields: row.customFields
      ? (JSON.parse(row.customFields) as Record<string, unknown>)
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireContactExists(ctx: CallerContext, contactId: string): Promise<void> {
  const r = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!r) throw new ApiError({ code: "NOT_FOUND", message: `Contact ${contactId} not found` });
}

async function requireProductExists(ctx: CallerContext, productId: string): Promise<void> {
  const r = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!r) throw new ApiError({ code: "NOT_FOUND", message: `Product ${productId} not found` });
}

export type CreateSubscriptionResult = {
  subscription: Subscription;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createSubscription(
  ctx: CallerContext,
  input: z.input<typeof subscriptionCreateInputSchema>,
  options: MutationOptions = {},
): Promise<CreateSubscriptionResult> {
  const parsed = subscriptionCreateInputSchema.parse(input);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateSubscriptionResult>(ctx, idempotencyKey, "subscription.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  await requireContactExists(ctx, parsed.contactId);
  if (parsed.productId) await requireProductExists(ctx, parsed.productId);

  const now = new Date().toISOString();
  const startedAt = parsed.startedAt ?? now;
  const mrrCents = computeMrrCents(parsed.amountCents, parsed.billingCycle, parsed.customCycleDays);
  const currentPeriodEnd = computePeriodEnd(startedAt, parsed.billingCycle, parsed.customCycleDays);
  const id = newId("subscription");

  const planned: Subscription = {
    id,
    accountId: ctx.accountId,
    contactId: parsed.contactId,
    productId: parsed.productId ?? null,
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    billingCycle: parsed.billingCycle,
    customCycleDays: parsed.customCycleDays ?? null,
    mrrCents,
    status: parsed.status,
    startedAt,
    currentPeriodStart: startedAt,
    currentPeriodEnd,
    canceledAt: null,
    cancelAt: null,
    cancelReason: null,
    customFields: parsed.customFields ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (dryRun) return { subscription: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.insert(subscriptions).values({
      id: planned.id,
      accountId: planned.accountId,
      contactId: planned.contactId,
      productId: planned.productId,
      amountCents: planned.amountCents,
      currency: planned.currency,
      billingCycle: planned.billingCycle,
      customCycleDays: planned.customCycleDays,
      mrrCents: planned.mrrCents,
      status: planned.status,
      startedAt: planned.startedAt,
      currentPeriodStart: planned.currentPeriodStart,
      currentPeriodEnd: planned.currentPeriodEnd,
      canceledAt: planned.canceledAt,
      cancelAt: planned.cancelAt,
      cancelReason: planned.cancelReason,
      customFields: planned.customFields ? JSON.stringify(planned.customFields) : null,
      createdAt: planned.createdAt,
      updatedAt: planned.updatedAt,
    });
    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "subscription.create",
      targetKind: "subscription",
      targetId: id,
      metadata: {
        contactId: planned.contactId,
        productId: planned.productId,
        amountCents: planned.amountCents,
        mrrCents: planned.mrrCents,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: CreateSubscriptionResult = { subscription: planned, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "subscription.create", responseStatus: 201, responseBody: body }),
      );
    }
  });
  return { subscription: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function getSubscription(ctx: CallerContext, id: string): Promise<Subscription> {
  const row = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Subscription ${id} not found` });
  return rowToSubscription(row);
}

export type ListSubscriptionsResult = { items: Subscription[] };

export async function listSubscriptions(
  ctx: CallerContext,
  filters: SubscriptionListFilters = {},
): Promise<ListSubscriptionsResult> {
  const conds = [eq(subscriptions.accountId, ctx.accountId)];
  if (filters.status) conds.push(eq(subscriptions.status, filters.status));
  if (filters.contactId) conds.push(eq(subscriptions.contactId, filters.contactId));
  if (filters.productId) conds.push(eq(subscriptions.productId, filters.productId));
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(...conds))
    .orderBy(desc(subscriptions.createdAt));
  return { items: rows.map(rowToSubscription) };
}

export type UpdateSubscriptionResult = {
  subscription: Subscription;
  before: Subscription;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateSubscription(
  ctx: CallerContext,
  id: string,
  patch: SubscriptionUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateSubscriptionResult> {
  const parsed = subscriptionUpdateInputSchema.parse(patch);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateSubscriptionResult>(ctx, idempotencyKey, "subscription.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Subscription ${id} not found` });
  const before = rowToSubscription(existing);

  if (before.status === "canceled" || before.status === "expired") {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: `Cannot edit subscription in status '${before.status}'`,
    });
  }

  if (parsed.productId !== undefined && parsed.productId !== null) {
    await requireProductExists(ctx, parsed.productId);
  }

  const now = new Date().toISOString();
  const nextAmount = parsed.amountCents ?? before.amountCents;
  const nextCycle: BillingCycle = parsed.billingCycle ?? before.billingCycle;
  const nextCustomDays =
    parsed.customCycleDays === undefined ? before.customCycleDays : parsed.customCycleDays;

  if (nextCycle === "custom_days" && (!nextCustomDays || nextCustomDays <= 0)) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "customCycleDays is required when billingCycle is custom_days",
      field: "customCycleDays",
    });
  }

  const recomputeMrr =
    parsed.amountCents !== undefined ||
    parsed.billingCycle !== undefined ||
    parsed.customCycleDays !== undefined;
  const mrrCents = recomputeMrr
    ? computeMrrCents(nextAmount, nextCycle, nextCustomDays)
    : before.mrrCents;

  const next: Subscription = {
    ...before,
    productId: parsed.productId === undefined ? before.productId : parsed.productId,
    amountCents: nextAmount,
    currency: parsed.currency ?? before.currency,
    billingCycle: nextCycle,
    customCycleDays: nextCustomDays,
    mrrCents,
    customFields: parsed.customFields === undefined ? before.customFields : parsed.customFields,
    updatedAt: now,
  };

  if (dryRun) return { subscription: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        productId: next.productId,
        amountCents: next.amountCents,
        currency: next.currency,
        billingCycle: next.billingCycle,
        customCycleDays: next.customCycleDays,
        mrrCents: next.mrrCents,
        customFields: next.customFields ? JSON.stringify(next.customFields) : null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, id));
    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "subscription.update",
      targetKind: "subscription",
      targetId: id,
      metadata: { before, patch: parsed },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: UpdateSubscriptionResult = { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "subscription.update", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type CancelSubscriptionResult = {
  subscription: Subscription;
  before: Subscription;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function cancelSubscription(
  ctx: CallerContext,
  id: string,
  input: CancelSubscriptionInput = {},
  options: MutationOptions = {},
): Promise<CancelSubscriptionResult> {
  const parsed = cancelSubscriptionInputSchema.parse(input);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CancelSubscriptionResult>(ctx, idempotencyKey, "subscription.cancel");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Subscription ${id} not found` });
  const before = rowToSubscription(existing);

  const now = new Date().toISOString();
  const futureCancel = parsed.cancelAt && new Date(parsed.cancelAt).getTime() > Date.now();

  // Future-dated cancel: schedule it but keep the current status alive.
  const next: Subscription = futureCancel
    ? {
        ...before,
        cancelAt: parsed.cancelAt ?? null,
        cancelReason: parsed.reason ?? before.cancelReason,
        updatedAt: now,
      }
    : {
        ...before,
        status: "canceled",
        canceledAt: now,
        cancelAt: parsed.cancelAt ?? null,
        cancelReason: parsed.reason ?? before.cancelReason,
        updatedAt: now,
      };

  if (dryRun) return { subscription: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        status: next.status,
        canceledAt: next.canceledAt,
        cancelAt: next.cancelAt,
        cancelReason: next.cancelReason,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, id));
    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "subscription.cancel",
      targetKind: "subscription",
      targetId: id,
      metadata: { before, reason: parsed.reason, cancelAt: parsed.cancelAt, scheduled: futureCancel },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: CancelSubscriptionResult = { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "subscription.cancel", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type PauseSubscriptionResult = CancelSubscriptionResult;

export async function pauseSubscription(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<PauseSubscriptionResult> {
  return setStatus(ctx, id, "paused", "subscription.pause", options);
}

export async function resumeSubscription(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<PauseSubscriptionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<PauseSubscriptionResult>(ctx, idempotencyKey, "subscription.resume");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Subscription ${id} not found` });
  const before = rowToSubscription(existing);
  if (before.status !== "paused") {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: `Cannot resume subscription in status '${before.status}'`,
    });
  }

  const now = new Date().toISOString();
  const next: Subscription = { ...before, status: "active", updatedAt: now };
  if (dryRun) return { subscription: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status: "active", updatedAt: now })
      .where(eq(subscriptions.id, id));
    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "subscription.resume",
      targetKind: "subscription",
      targetId: id,
      metadata: { before },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: PauseSubscriptionResult = { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "subscription.resume", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

async function setStatus(
  ctx: CallerContext,
  id: string,
  status: SubscriptionStatus,
  operation: string,
  options: MutationOptions,
): Promise<PauseSubscriptionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<PauseSubscriptionResult>(ctx, idempotencyKey, operation);
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Subscription ${id} not found` });
  const before = rowToSubscription(existing);
  const now = new Date().toISOString();
  const next: Subscription = { ...before, status, updatedAt: now };

  if (dryRun) return { subscription: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ status, updatedAt: now })
      .where(eq(subscriptions.id, id));
    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation,
      targetKind: "subscription",
      targetId: id,
      metadata: { before, status },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: PauseSubscriptionResult = { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation, responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { subscription: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}
