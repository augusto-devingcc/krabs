import { and, desc, eq, gte, lte, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  agentActions,
  invoices,
  invoiceStatuses,
  type InvoiceRow,
  type InvoiceStatus,
} from "../db/schema.js";
import { newId, idSchema } from "../contract/ids.js";
import { ApiError } from "../contract/errors.js";
import { formatInvoiceNumber } from "./finance-utils.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export const invoiceCreateInputSchema = z.object({
  counterparty: z.string().max(255).optional(),
  subscriptionId: idSchema("subscription").optional(),
  amountCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  note: z.string().max(2000).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const invoiceUpdateInputSchema = z.object({
  counterparty: z.string().max(255).nullable().optional(),
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

export const invoiceListFiltersSchema = z.object({
  status: z.enum(invoiceStatuses).optional(),
  subscriptionId: idSchema("subscription").optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const markInvoicePaidInputSchema = z.object({
  paidAt: z.string().datetime().optional(),
});

export type InvoiceCreateInput = z.input<typeof invoiceCreateInputSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateInputSchema>;
export type InvoiceListFilters = z.infer<typeof invoiceListFiltersSchema>;
export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidInputSchema>;

export type Invoice = {
  id: string;
  accountId: string;
  counterparty: string | null;
  subscriptionId: string | null;
  number: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  note: string | null;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    accountId: row.accountId,
    counterparty: row.counterparty,
    subscriptionId: row.subscriptionId,
    number: row.number,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status as InvoiceStatus,
    issuedAt: row.issuedAt,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    voidedAt: row.voidedAt,
    note: row.note,
    customFields: row.customFields
      ? (JSON.parse(row.customFields) as Record<string, unknown>)
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function computeNextInvoiceNumber(ctx: CallerContext, year: number): Promise<string> {
  const prefix = `INV-${year}-`;
  // Pull the lexicographically largest number for this account+year prefix; INV-YYYY-NNNN
  // is zero-padded so string MAX == numeric MAX within a year.
  const row = await db
    .select({ max: sql<string | null>`MAX(${invoices.number})` })
    .from(invoices)
    .where(and(eq(invoices.accountId, ctx.accountId), like(invoices.number, `${prefix}%`)))
    .then((r) => r[0]);
  const max = row?.max ?? null;
  let nextSeq = 1;
  if (max) {
    const tail = max.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!Number.isNaN(parsed)) nextSeq = parsed + 1;
  }
  return formatInvoiceNumber(year, nextSeq);
}

export type CreateInvoiceResult = {
  invoice: Invoice;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createInvoice(
  ctx: CallerContext,
  input: z.input<typeof invoiceCreateInputSchema>,
  options: MutationOptions = {},
): Promise<CreateInvoiceResult> {
  const parsed = invoiceCreateInputSchema.parse(input);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateInvoiceResult>(ctx, idempotencyKey, "invoice.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const now = new Date().toISOString();
  const issuedAt = parsed.issuedAt ?? now;
  const year = new Date(issuedAt).getUTCFullYear();
  const number = await computeNextInvoiceNumber(ctx, year);
  const id = newId("invoice");

  const planned: Invoice = {
    id,
    accountId: ctx.accountId,
    counterparty: parsed.counterparty ?? null,
    subscriptionId: parsed.subscriptionId ?? null,
    number,
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    status: "draft",
    issuedAt,
    dueAt: parsed.dueAt ?? null,
    paidAt: null,
    voidedAt: null,
    note: parsed.note ?? null,
    customFields: parsed.customFields ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (dryRun) return { invoice: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.insert(invoices).values({
      id: planned.id,
      accountId: planned.accountId,
      counterparty: planned.counterparty,
      subscriptionId: planned.subscriptionId,
      number: planned.number,
      amountCents: planned.amountCents,
      currency: planned.currency,
      status: planned.status,
      issuedAt: planned.issuedAt,
      dueAt: planned.dueAt,
      paidAt: planned.paidAt,
      voidedAt: planned.voidedAt,
      note: planned.note,
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
      operation: "invoice.create",
      targetKind: "invoice",
      targetId: id,
      metadata: {
        number: planned.number,
        counterparty: planned.counterparty,
        amountCents: planned.amountCents,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: CreateInvoiceResult = { invoice: planned, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "invoice.create", responseStatus: 201, responseBody: body }),
      );
    }
  });
  return { invoice: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function getInvoice(ctx: CallerContext, id: string): Promise<Invoice> {
  const row = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Invoice ${id} not found` });
  return rowToInvoice(row);
}

export type ListInvoicesResult = { items: Invoice[] };

export async function listInvoices(
  ctx: CallerContext,
  filters: InvoiceListFilters = {},
): Promise<ListInvoicesResult> {
  const conds = [eq(invoices.accountId, ctx.accountId)];
  if (filters.status) conds.push(eq(invoices.status, filters.status));
  if (filters.subscriptionId) conds.push(eq(invoices.subscriptionId, filters.subscriptionId));
  if (filters.from) conds.push(gte(invoices.issuedAt, filters.from));
  if (filters.to) conds.push(lte(invoices.issuedAt, filters.to));
  const rows = await db
    .select()
    .from(invoices)
    .where(and(...conds))
    .orderBy(desc(invoices.issuedAt));
  return { items: rows.map(rowToInvoice) };
}

export type UpdateInvoiceResult = {
  invoice: Invoice;
  before: Invoice;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

const TERMINAL_INVOICE_STATUSES = ["paid", "void", "refunded"] as const;

export async function updateInvoice(
  ctx: CallerContext,
  id: string,
  patch: InvoiceUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateInvoiceResult> {
  const parsed = invoiceUpdateInputSchema.parse(patch);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateInvoiceResult>(ctx, idempotencyKey, "invoice.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Invoice ${id} not found` });
  const before = rowToInvoice(existing);

  if ((TERMINAL_INVOICE_STATUSES as readonly InvoiceStatus[]).includes(before.status)) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: `Cannot edit invoice in status '${before.status}'`,
    });
  }

  const now = new Date().toISOString();
  const next: Invoice = {
    ...before,
    counterparty: parsed.counterparty === undefined ? before.counterparty : parsed.counterparty,
    amountCents: parsed.amountCents ?? before.amountCents,
    currency: parsed.currency ?? before.currency,
    issuedAt: parsed.issuedAt ?? before.issuedAt,
    dueAt: parsed.dueAt === undefined ? before.dueAt : parsed.dueAt,
    note: parsed.note === undefined ? before.note : parsed.note,
    customFields: parsed.customFields === undefined ? before.customFields : parsed.customFields,
    updatedAt: now,
  };

  if (dryRun) return { invoice: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        counterparty: next.counterparty,
        amountCents: next.amountCents,
        currency: next.currency,
        issuedAt: next.issuedAt,
        dueAt: next.dueAt,
        note: next.note,
        customFields: next.customFields ? JSON.stringify(next.customFields) : null,
        updatedAt: now,
      })
      .where(eq(invoices.id, id));
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
      operation: "invoice.update",
      targetKind: "invoice",
      targetId: id,
      metadata: { before, patch: parsed },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: UpdateInvoiceResult = { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "invoice.update", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type InvoiceTransitionResult = {
  invoice: Invoice;
  before: Invoice;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function markInvoiceSent(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<InvoiceTransitionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<InvoiceTransitionResult>(ctx, idempotencyKey, "invoice.send");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Invoice ${id} not found` });
  const before = rowToInvoice(existing);
  if (before.status !== "draft") {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: `Cannot send invoice in status '${before.status}'`,
    });
  }

  const now = new Date().toISOString();
  const next: Invoice = { ...before, status: "sent", updatedAt: now };
  if (dryRun) return { invoice: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.update(invoices).set({ status: "sent", updatedAt: now }).where(eq(invoices.id, id));
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
      operation: "invoice.send",
      targetKind: "invoice",
      targetId: id,
      metadata: { before },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: InvoiceTransitionResult = { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "invoice.send", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function markInvoicePaid(
  ctx: CallerContext,
  id: string,
  input: MarkInvoicePaidInput = {},
  options: MutationOptions = {},
): Promise<InvoiceTransitionResult> {
  const parsed = markInvoicePaidInputSchema.parse(input);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<InvoiceTransitionResult>(ctx, idempotencyKey, "invoice.pay");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Invoice ${id} not found` });
  const before = rowToInvoice(existing);
  if (before.status !== "sent" && before.status !== "overdue") {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: `Cannot mark paid: invoice is in status '${before.status}'`,
    });
  }

  const now = new Date().toISOString();
  const paidAt = parsed.paidAt ?? now;
  const next: Invoice = { ...before, status: "paid", paidAt, updatedAt: now };
  if (dryRun) return { invoice: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ status: "paid", paidAt, updatedAt: now })
      .where(eq(invoices.id, id));
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
      operation: "invoice.pay",
      targetKind: "invoice",
      targetId: id,
      metadata: { before, paidAt },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: InvoiceTransitionResult = { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "invoice.pay", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function voidInvoice(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<InvoiceTransitionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<InvoiceTransitionResult>(ctx, idempotencyKey, "invoice.void");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Invoice ${id} not found` });
  const before = rowToInvoice(existing);
  if (before.status === "paid" || before.status === "refunded") {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: `Cannot void invoice in status '${before.status}'`,
    });
  }

  const now = new Date().toISOString();
  const next: Invoice = { ...before, status: "void", voidedAt: now, updatedAt: now };
  if (dryRun) return { invoice: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ status: "void", voidedAt: now, updatedAt: now })
      .where(eq(invoices.id, id));
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
      operation: "invoice.void",
      targetKind: "invoice",
      targetId: id,
      metadata: { before },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: InvoiceTransitionResult = { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "invoice.void", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { invoice: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}
