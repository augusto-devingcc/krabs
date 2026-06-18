import { and, between, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  expenses,
  invoices,
  products,
  subscriptions,
  type ExpenseCategory,
  type BillingCycle,
} from "../db/schema.js";
import type { CallerContext } from "./shared.js";

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return { from: from.toISOString(), to: now.toISOString() };
}

function resolveRange(input: { from?: string; to?: string } | undefined): {
  from: string;
  to: string;
} {
  const defaults = currentMonthRange();
  return {
    from: input?.from ?? defaults.from,
    to: input?.to ?? defaults.to,
  };
}

export type FinanceSummary = {
  period: { from: string; to: string };
  revenue: { paid_cents: number; pending_cents: number; currency: string };
  expenses: { total_cents: number; currency: string };
  net_cents: number;
  mrr_cents: number;
  arr_cents: number;
  counts: {
    active_subscriptions: number;
    invoices_outstanding: number;
    expenses_count_in_period: number;
  };
};

export async function getFinanceSummary(
  ctx: CallerContext,
  range?: { from?: string; to?: string },
): Promise<FinanceSummary> {
  const { from, to } = resolveRange(range);

  const paidRow = await db
    .select({
      sum: sql<number | null>`COALESCE(SUM(${invoices.amountCents}), 0)`,
      currency: sql<string | null>`MIN(${invoices.currency})`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.accountId, ctx.accountId),
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, from),
        lte(invoices.paidAt, to),
      ),
    )
    .then((r) => r[0]);

  const pendingRow = await db
    .select({ sum: sql<number | null>`COALESCE(SUM(${invoices.amountCents}), 0)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.accountId, ctx.accountId),
        inArray(invoices.status, ["sent", "overdue"]),
      ),
    )
    .then((r) => r[0]);

  const expenseRow = await db
    .select({
      sum: sql<number | null>`COALESCE(SUM(${expenses.amountCents}), 0)`,
      currency: sql<string | null>`MIN(${expenses.currency})`,
      n: count(),
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.accountId, ctx.accountId),
        gte(expenses.occurredAt, from),
        lte(expenses.occurredAt, to),
      ),
    )
    .then((r) => r[0]);

  const mrrRow = await db
    .select({ sum: sql<number | null>`COALESCE(SUM(${subscriptions.mrrCents}), 0)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, ctx.accountId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .then((r) => r[0]);

  const activeSubsRow = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, ctx.accountId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .then((r) => r[0]);

  const outstandingRow = await db
    .select({ n: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.accountId, ctx.accountId),
        inArray(invoices.status, ["sent", "overdue"]),
      ),
    )
    .then((r) => r[0]);

  const paidCents = paidRow?.sum ?? 0;
  const pendingCents = pendingRow?.sum ?? 0;
  const totalExpenses = expenseRow?.sum ?? 0;
  const mrrCents = mrrRow?.sum ?? 0;

  return {
    period: { from, to },
    revenue: {
      paid_cents: paidCents,
      pending_cents: pendingCents,
      currency: paidRow?.currency ?? "USD",
    },
    expenses: {
      total_cents: totalExpenses,
      currency: expenseRow?.currency ?? "USD",
    },
    net_cents: paidCents - totalExpenses,
    mrr_cents: mrrCents,
    arr_cents: mrrCents * 12,
    counts: {
      active_subscriptions: activeSubsRow?.n ?? 0,
      invoices_outstanding: outstandingRow?.n ?? 0,
      expenses_count_in_period: expenseRow?.n ?? 0,
    },
  };
}

export type MrrBreakdown = {
  mrr_cents: number;
  arr_cents: number;
  by_product: Array<{
    product_id: string | null;
    product_name: string | null;
    count: number;
    mrr_cents: number;
  }>;
  by_billing_cycle: Array<{
    billing_cycle: BillingCycle;
    count: number;
    mrr_cents: number;
  }>;
  trialing_count: number;
  active_count: number;
  paused_count: number;
};

export async function getMrrBreakdown(ctx: CallerContext): Promise<MrrBreakdown> {
  const totalRow = await db
    .select({ sum: sql<number | null>`COALESCE(SUM(${subscriptions.mrrCents}), 0)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, ctx.accountId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .then((r) => r[0]);
  const mrrCents = totalRow?.sum ?? 0;

  const byProductRows = await db
    .select({
      productId: subscriptions.productId,
      productName: products.name,
      n: count(),
      mrr: sql<number>`COALESCE(SUM(${subscriptions.mrrCents}), 0)`,
    })
    .from(subscriptions)
    .leftJoin(products, eq(products.id, subscriptions.productId))
    .where(
      and(
        eq(subscriptions.accountId, ctx.accountId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .groupBy(subscriptions.productId, products.name)
    .orderBy(desc(sql`COALESCE(SUM(${subscriptions.mrrCents}), 0)`));

  const byCycleRows = await db
    .select({
      cycle: subscriptions.billingCycle,
      n: count(),
      mrr: sql<number>`COALESCE(SUM(${subscriptions.mrrCents}), 0)`,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.accountId, ctx.accountId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .groupBy(subscriptions.billingCycle)
    .orderBy(desc(sql`COALESCE(SUM(${subscriptions.mrrCents}), 0)`));

  const trialingRow = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.accountId, ctx.accountId), eq(subscriptions.status, "trialing")))
    .then((r) => r[0]);
  const activeRow = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.accountId, ctx.accountId), eq(subscriptions.status, "active")))
    .then((r) => r[0]);
  const pausedRow = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.accountId, ctx.accountId), eq(subscriptions.status, "paused")))
    .then((r) => r[0]);

  return {
    mrr_cents: mrrCents,
    arr_cents: mrrCents * 12,
    by_product: byProductRows.map((r) => ({
      product_id: r.productId,
      product_name: r.productName,
      count: r.n,
      mrr_cents: Number(r.mrr ?? 0),
    })),
    by_billing_cycle: byCycleRows.map((r) => ({
      billing_cycle: r.cycle as BillingCycle,
      count: r.n,
      mrr_cents: Number(r.mrr ?? 0),
    })),
    trialing_count: trialingRow?.n ?? 0,
    active_count: activeRow?.n ?? 0,
    paused_count: pausedRow?.n ?? 0,
  };
}

export type ExpensesByCategory = {
  period: { from: string; to: string };
  total_cents: number;
  by_category: Array<{ category: ExpenseCategory; count: number; total_cents: number }>;
};

export async function getExpensesByCategory(
  ctx: CallerContext,
  range?: { from?: string; to?: string },
): Promise<ExpensesByCategory> {
  const { from, to } = resolveRange(range);

  const rows = await db
    .select({
      category: expenses.category,
      n: count(),
      total: sql<number>`COALESCE(SUM(${expenses.amountCents}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.accountId, ctx.accountId),
        between(expenses.occurredAt, from, to),
      ),
    )
    .groupBy(expenses.category)
    .orderBy(desc(sql`COALESCE(SUM(${expenses.amountCents}), 0)`));

  const byCategory = rows.map((r) => ({
    category: r.category as ExpenseCategory,
    count: r.n,
    total_cents: Number(r.total ?? 0),
  }));
  const total = byCategory.reduce((acc, c) => acc + c.total_cents, 0);
  return { period: { from, to }, total_cents: total, by_category: byCategory };
}

// ─────────────────────────────────────────────────────────────────
// Funnel metrics — ROAS over a window.
//
//   ROAS  = paid revenue in window ÷ ad spend in window
//
// "ad spend" is the sum of expenses with category='ads' inside the period.
// Source breakdown comes from the expense.source enum (meta_ads, google_ads,
// etc. — recorded by an agent piping a platform CLI into `expense.create`).
// ─────────────────────────────────────────────────────────────────

export type FunnelMetrics = {
  period: { from: string; to: string };
  revenue: { paid_cents: number; currency: string };
  ad_spend: {
    total_cents: number;
    currency: string;
    by_source: Array<{ source: string; total_cents: number }>;
  };
  roas: number | null; // null when ad_spend is 0
};

export async function getFunnelMetrics(
  ctx: CallerContext,
  range?: { from?: string; to?: string },
): Promise<FunnelMetrics> {
  const { from, to } = resolveRange(range);

  const paidRow = await db
    .select({
      sum: sql<number | null>`COALESCE(SUM(${invoices.amountCents}), 0)`,
      currency: sql<string | null>`MIN(${invoices.currency})`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.accountId, ctx.accountId),
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, from),
        lte(invoices.paidAt, to),
      ),
    )
    .then((r) => r[0]);
  const paidCents = Number(paidRow?.sum ?? 0);
  const revenueCurrency = paidRow?.currency ?? "USD";

  const adSpendRow = await db
    .select({
      sum: sql<number | null>`COALESCE(SUM(${expenses.amountCents}), 0)`,
      currency: sql<string | null>`MIN(${expenses.currency})`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.accountId, ctx.accountId),
        eq(expenses.category, "ads"),
        between(expenses.occurredAt, from, to),
      ),
    )
    .then((r) => r[0]);
  const adSpendCents = Number(adSpendRow?.sum ?? 0);

  const bySourceRows = await db
    .select({
      source: expenses.source,
      total: sql<number>`COALESCE(SUM(${expenses.amountCents}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.accountId, ctx.accountId),
        eq(expenses.category, "ads"),
        between(expenses.occurredAt, from, to),
      ),
    )
    .groupBy(expenses.source)
    .orderBy(desc(sql`COALESCE(SUM(${expenses.amountCents}), 0)`));

  return {
    period: { from, to },
    revenue: { paid_cents: paidCents, currency: revenueCurrency },
    ad_spend: {
      total_cents: adSpendCents,
      currency: adSpendRow?.currency ?? "USD",
      by_source: bySourceRows.map((r) => ({
        source: r.source as string,
        total_cents: Number(r.total ?? 0),
      })),
    },
    roas: adSpendCents > 0 ? paidCents / adSpendCents : null,
  };
}
