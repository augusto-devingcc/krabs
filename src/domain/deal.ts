import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db/client.js";
import { agentActions, contacts, deals, type DealRow } from "@/db/schema.js";
import { newId } from "@/contract/ids.js";
import { ApiError } from "@/contract/errors.js";
import type {
  Deal,
  DealCreateInput,
  DealUpdateInput,
  DealListFilters,
} from "@/contract/schemas/deal.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

function rowToDeal(row: DealRow): Deal {
  return {
    id: row.id,
    accountId: row.accountId,
    contactId: row.contactId,
    title: row.title,
    stage: row.stage,
    status: row.status as Deal["status"],
    value: row.value,
    currency: row.currency,
    expectedCloseDate: row.expectedCloseDate,
    customFields: row.customFields ? (JSON.parse(row.customFields) as Record<string, unknown>) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireContactExists(ctx: CallerContext, contactId: string): Promise<void> {
  const c = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!c) throw new ApiError({ code: "NOT_FOUND", message: `Contact ${contactId} not found` });
}

// ───── create

export type CreateDealResult = {
  deal: Deal;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createDeal(
  ctx: CallerContext,
  input: DealCreateInput,
  options: MutationOptions = {},
): Promise<CreateDealResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateDealResult>(ctx, idempotencyKey, "deal.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  if (input.contactId) await requireContactExists(ctx, input.contactId);

  const now = new Date().toISOString();
  const id = newId("deal");
  const planned: Deal = {
    id,
    accountId: ctx.accountId,
    contactId: input.contactId ?? null,
    title: input.title,
    stage: input.stage ?? "new",
    status: input.status ?? "open",
    value: input.value ?? null,
    currency: input.currency ?? null,
    expectedCloseDate: input.expectedCloseDate ?? null,
    customFields: input.customFields ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (dryRun) return { deal: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.insert(deals).values({
      id: planned.id,
      accountId: planned.accountId,
      contactId: planned.contactId,
      title: planned.title,
      stage: planned.stage,
      status: planned.status,
      value: planned.value,
      currency: planned.currency,
      expectedCloseDate: planned.expectedCloseDate,
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
      operation: "deal.create",
      targetKind: "deal",
      targetId: id,
      metadata: { title: input.title, stage: planned.stage },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: CreateDealResult = { deal: planned, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "deal.create", responseStatus: 201, responseBody: body }),
      );
    }
  });
  return { deal: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───── get

export async function getDeal(ctx: CallerContext, id: string): Promise<Deal> {
  const row = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Deal ${id} not found` });
  return rowToDeal(row);
}

// ───── list

export type ListDealsResult = { items: Deal[]; nextCursor: string | null };

export async function listDeals(ctx: CallerContext, filters: DealListFilters): Promise<ListDealsResult> {
  const limit = filters.limit ?? 50;
  const conds = [eq(deals.accountId, ctx.accountId)];
  if (filters.contactId) conds.push(eq(deals.contactId, filters.contactId));
  if (filters.stage) conds.push(eq(deals.stage, filters.stage));
  if (filters.status) conds.push(eq(deals.status, filters.status));
  if (filters.cursor) conds.push(gt(deals.id, filters.cursor));
  const rows = await db
    .select()
    .from(deals)
    .where(and(...conds))
    .orderBy(asc(deals.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: trimmed.map(rowToDeal),
    nextCursor: hasMore ? (trimmed.at(-1)?.id ?? null) : null,
  };
}

// ───── update

export type UpdateDealResult = {
  deal: Deal;
  before: Deal;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateDeal(
  ctx: CallerContext,
  id: string,
  patch: DealUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateDealResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateDealResult>(ctx, idempotencyKey, "deal.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Deal ${id} not found` });

  const before = rowToDeal(existing);
  const now = new Date().toISOString();

  if (patch.contactId !== undefined && patch.contactId !== null) {
    await requireContactExists(ctx, patch.contactId);
  }

  const next: Deal = {
    ...before,
    title: patch.title ?? before.title,
    contactId: patch.contactId === undefined ? before.contactId : patch.contactId,
    stage: patch.stage ?? before.stage,
    status: patch.status ?? before.status,
    value: patch.value === undefined ? before.value : patch.value,
    currency: patch.currency === undefined ? before.currency : patch.currency,
    expectedCloseDate: patch.expectedCloseDate === undefined ? before.expectedCloseDate : patch.expectedCloseDate,
    customFields: patch.customFields === undefined ? before.customFields : patch.customFields,
    updatedAt: now,
  };

  if (dryRun) return { deal: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(deals)
      .set({
        title: next.title,
        contactId: next.contactId,
        stage: next.stage,
        status: next.status,
        value: next.value,
        currency: next.currency,
        expectedCloseDate: next.expectedCloseDate,
        customFields: next.customFields ? JSON.stringify(next.customFields) : null,
        updatedAt: now,
      })
      .where(eq(deals.id, id));

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
      operation: "deal.update",
      targetKind: "deal",
      targetId: id,
      metadata: { before, patch },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    if (idempotencyKey) {
      const body: UpdateDealResult = { deal: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "deal.update", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { deal: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───── delete

export type DeleteDealResult = {
  deletedId: string;
  snapshot: Deal;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function deleteDeal(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<DeleteDealResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DeleteDealResult>(ctx, idempotencyKey, "deal.delete");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Deal ${id} not found` });

  const snapshot = rowToDeal(existing);
  if (dryRun) return { deletedId: id, snapshot, agentActionId: null, dryRun: true, replayed: false };

  const now = new Date().toISOString();
  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
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
      operation: "deal.delete",
      targetKind: "deal",
      targetId: id,
      metadata: { snapshot },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    await tx.delete(deals).where(eq(deals.id, id));

    if (idempotencyKey) {
      const body: DeleteDealResult = { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "deal.delete", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
}
