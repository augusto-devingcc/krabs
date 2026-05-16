import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  agentActions,
  expenses,
  expenseCategories,
  expenseSources,
  type ExpenseRow,
  type ExpenseCategory,
  type ExpenseSource,
} from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { ApiError } from "../contract/errors.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export const expenseCreateInputSchema = z.object({
  amountCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  category: z.enum(expenseCategories),
  vendor: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  occurredAt: z.string().datetime().optional(),
  source: z.enum(expenseSources).default("manual"),
  sourceRef: z.string().trim().max(100).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const expenseUpdateInputSchema = z.object({
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  category: z.enum(expenseCategories).optional(),
  vendor: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  source: z.enum(expenseSources).optional(),
  sourceRef: z.string().trim().max(100).nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

export const expenseListFiltersSchema = z.object({
  category: z.enum(expenseCategories).optional(),
  vendor: z.string().trim().max(100).optional(),
  source: z.enum(expenseSources).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type ExpenseCreateInput = z.input<typeof expenseCreateInputSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateInputSchema>;
export type ExpenseListFilters = z.infer<typeof expenseListFiltersSchema>;

export type Expense = {
  id: string;
  accountId: string;
  amountCents: number;
  currency: string;
  category: ExpenseCategory;
  vendor: string | null;
  description: string | null;
  occurredAt: string;
  source: ExpenseSource;
  sourceRef: string | null;
  customFields: Record<string, unknown> | null;
  createdAt: string;
};

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    accountId: row.accountId,
    amountCents: row.amountCents,
    currency: row.currency,
    category: row.category as ExpenseCategory,
    vendor: row.vendor,
    description: row.description,
    occurredAt: row.occurredAt,
    source: row.source as ExpenseSource,
    sourceRef: row.sourceRef,
    customFields: row.customFields
      ? (JSON.parse(row.customFields) as Record<string, unknown>)
      : null,
    createdAt: row.createdAt,
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = (err as { message?: string }).message ?? "";
  return /UNIQUE constraint failed/i.test(msg) || /SQLITE_CONSTRAINT/i.test(msg);
}

export type CreateExpenseResult = {
  expense: Expense;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createExpense(
  ctx: CallerContext,
  input: z.input<typeof expenseCreateInputSchema>,
  options: MutationOptions = {},
): Promise<CreateExpenseResult> {
  const parsed = expenseCreateInputSchema.parse(input);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateExpenseResult>(ctx, idempotencyKey, "expense.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const now = new Date().toISOString();
  const id = newId("expense");
  const planned: Expense = {
    id,
    accountId: ctx.accountId,
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    category: parsed.category,
    vendor: parsed.vendor ?? null,
    description: parsed.description ?? null,
    occurredAt: parsed.occurredAt ?? now,
    source: parsed.source,
    sourceRef: parsed.sourceRef ?? null,
    customFields: parsed.customFields ?? null,
    createdAt: now,
  };

  if (dryRun) return { expense: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        id: planned.id,
        accountId: planned.accountId,
        amountCents: planned.amountCents,
        currency: planned.currency,
        category: planned.category,
        vendor: planned.vendor,
        description: planned.description,
        occurredAt: planned.occurredAt,
        source: planned.source,
        sourceRef: planned.sourceRef,
        customFields: planned.customFields ? JSON.stringify(planned.customFields) : null,
        createdAt: planned.createdAt,
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
        operation: "expense.create",
        targetKind: "expense",
        targetId: id,
        metadata: {
          category: planned.category,
          amountCents: planned.amountCents,
          source: planned.source,
        },
        createdAt: now,
      };
      if (intent) actionOpts.intent = intent;
      await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
      if (idempotencyKey) {
        const body: CreateExpenseResult = { expense: planned, agentActionId: actionId, dryRun: false, replayed: false };
        await tx.insert(idempotencyKeys).values(
          buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "expense.create", responseStatus: 201, responseBody: body }),
        );
      }
    });
  } catch (err) {
    // Import-source dedup: non-manual collisions return the existing row.
    if (isUniqueConstraintError(err) && planned.source !== "manual" && planned.sourceRef) {
      const existing = await db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.accountId, ctx.accountId),
            eq(expenses.source, planned.source),
            eq(expenses.sourceRef, planned.sourceRef),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (existing) {
        return { expense: rowToExpense(existing), agentActionId: null, dryRun: false, replayed: true };
      }
    }
    throw err;
  }
  return { expense: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function getExpense(ctx: CallerContext, id: string): Promise<Expense> {
  const row = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Expense ${id} not found` });
  return rowToExpense(row);
}

export type ListExpensesResult = { items: Expense[] };

export async function listExpenses(
  ctx: CallerContext,
  filters: ExpenseListFilters = {},
): Promise<ListExpensesResult> {
  const conds = [eq(expenses.accountId, ctx.accountId)];
  if (filters.category) conds.push(eq(expenses.category, filters.category));
  if (filters.source) conds.push(eq(expenses.source, filters.source));
  if (filters.vendor) conds.push(like(expenses.vendor, `%${filters.vendor}%`));
  if (filters.from) conds.push(gte(expenses.occurredAt, filters.from));
  if (filters.to) conds.push(lte(expenses.occurredAt, filters.to));
  const rows = await db
    .select()
    .from(expenses)
    .where(and(...conds))
    .orderBy(desc(expenses.occurredAt));
  return { items: rows.map(rowToExpense) };
}

export type UpdateExpenseResult = {
  expense: Expense;
  before: Expense;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateExpense(
  ctx: CallerContext,
  id: string,
  patch: ExpenseUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateExpenseResult> {
  const parsed = expenseUpdateInputSchema.parse(patch);
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateExpenseResult>(ctx, idempotencyKey, "expense.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Expense ${id} not found` });
  const before = rowToExpense(existing);

  const next: Expense = {
    ...before,
    amountCents: parsed.amountCents ?? before.amountCents,
    currency: parsed.currency ?? before.currency,
    category: parsed.category ?? before.category,
    vendor: parsed.vendor === undefined ? before.vendor : parsed.vendor,
    description: parsed.description === undefined ? before.description : parsed.description,
    occurredAt: parsed.occurredAt ?? before.occurredAt,
    source: parsed.source ?? before.source,
    sourceRef: parsed.sourceRef === undefined ? before.sourceRef : parsed.sourceRef,
    customFields: parsed.customFields === undefined ? before.customFields : parsed.customFields,
  };

  if (dryRun) return { expense: next, before, agentActionId: null, dryRun: true, replayed: false };

  const now = new Date().toISOString();
  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        amountCents: next.amountCents,
        currency: next.currency,
        category: next.category,
        vendor: next.vendor,
        description: next.description,
        occurredAt: next.occurredAt,
        source: next.source,
        sourceRef: next.sourceRef,
        customFields: next.customFields ? JSON.stringify(next.customFields) : null,
      })
      .where(eq(expenses.id, id));
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
      operation: "expense.update",
      targetKind: "expense",
      targetId: id,
      metadata: { before, patch: parsed },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: UpdateExpenseResult = { expense: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "expense.update", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { expense: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type DeleteExpenseResult = {
  deletedId: string;
  snapshot: Expense;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function deleteExpense(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<DeleteExpenseResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DeleteExpenseResult>(ctx, idempotencyKey, "expense.delete");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Expense ${id} not found` });
  const snapshot = rowToExpense(existing);

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
      operation: "expense.delete",
      targetKind: "expense",
      targetId: id,
      metadata: { snapshot },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    await tx.delete(expenses).where(eq(expenses.id, id));
    if (idempotencyKey) {
      const body: DeleteExpenseResult = { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "expense.delete", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
}
