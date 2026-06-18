import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// Single-account, self-host personal finance tracker. `accounts` is retained
// as internal plumbing so multi-tenant column filters stay intact, but in
// practice there is exactly one row (seeded by `pnpm setup`).
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: text("created_at").notNull().default(nowDefault),
  updatedAt: text("updated_at").notNull().default(nowDefault),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPreview: text("token_preview").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountIdx: index("api_keys_account_idx").on(t.accountId),
    hashIdx: index("api_keys_hash_idx").on(t.tokenHash),
  }),
);

export const agentActions = sqliteTable(
  "agent_actions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKeys.id),
    operation: text("operation").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    intent: text("intent"),
    // JSON: structured metadata (e.g. snapshot of deleted entity).
    metadata: text("metadata"),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountCreatedIdx: index("agent_actions_account_created_idx").on(t.accountId, t.createdAt),
    targetIdx: index("agent_actions_target_idx").on(t.targetKind, t.targetId),
    actorIdx: index("agent_actions_actor_idx").on(t.apiKeyId),
  }),
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKeys.id),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountKeyIdx: uniqueIndex("idempotency_keys_account_key_idx").on(t.accountId, t.key),
  }),
);

// ─────────────────────────────────────────────────────────────────
// Financial primitives: products, subscriptions, invoices, expenses.
// All money is stored as integer cents to avoid float drift. Currency defaults
// to USD per row but is overridable. MRR is denormalized on subscriptions for
// O(1) aggregate queries. `counterparty` is free-text (a customer/vendor name)
// since this is a single-operator tracker with no contact graph.
// ─────────────────────────────────────────────────────────────────

export const productKinds = ["saas", "service", "retainer", "product", "other"] as const;
export type ProductKind = (typeof productKinds)[number];

export const pricingModels = ["one_time", "recurring", "per_unit", "tiered"] as const;
export type PricingModel = (typeof pricingModels)[number];

export const billingCycles = ["monthly", "quarterly", "yearly", "custom_days"] as const;
export type BillingCycle = (typeof billingCycles)[number];

export const productStatuses = ["active", "archived"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("saas"),
    pricingModel: text("pricing_model").notNull().default("recurring"),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    billingCycle: text("billing_cycle"),
    customCycleDays: integer("custom_cycle_days"),
    status: text("status").notNull().default("active"),
    customFields: text("custom_fields"),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountIdx: index("products_account_idx").on(t.accountId),
    accountStatusIdx: index("products_account_status_idx").on(t.accountId, t.status),
  }),
);

export const subscriptionStatuses = [
  "trialing",
  "active",
  "paused",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // Free-text customer/payer name. Optional.
    counterparty: text("counterparty"),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    billingCycle: text("billing_cycle").notNull(),
    customCycleDays: integer("custom_cycle_days"),
    // MRR normalized to monthly cents — denormalized for fast SUM aggregates.
    mrrCents: integer("mrr_cents").notNull(),
    status: text("status").notNull().default("active"),
    startedAt: text("started_at").notNull(),
    currentPeriodStart: text("current_period_start").notNull(),
    currentPeriodEnd: text("current_period_end").notNull(),
    canceledAt: text("canceled_at"),
    cancelAt: text("cancel_at"),
    cancelReason: text("cancel_reason"),
    customFields: text("custom_fields"),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountStatusIdx: index("subs_account_status_idx").on(t.accountId, t.status),
    productIdx: index("subs_product_idx").on(t.productId),
    periodEndIdx: index("subs_period_end_idx").on(t.accountId, t.currentPeriodEnd),
  }),
);

export const invoiceStatuses = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
  "refunded",
] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // Free-text customer/payer name. Optional.
    counterparty: text("counterparty"),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    number: text("number").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("draft"),
    issuedAt: text("issued_at").notNull(),
    dueAt: text("due_at"),
    paidAt: text("paid_at"),
    voidedAt: text("voided_at"),
    note: text("note"),
    customFields: text("custom_fields"),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountStatusIdx: index("invoices_account_status_idx").on(t.accountId, t.status),
    subscriptionIdx: index("invoices_subscription_idx").on(t.subscriptionId),
    issuedIdx: index("invoices_account_issued_idx").on(t.accountId, t.issuedAt),
    numberIdx: uniqueIndex("invoices_account_number_idx").on(t.accountId, t.number),
  }),
);

export const expenseCategories = [
  "ads",
  "infra",
  "contractor",
  "software",
  "tax",
  "fees",
  "salary",
  "office",
  "travel",
  "other",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const expenseSources = [
  "manual",
  "stripe",
  "bank",
  "google_ads",
  "meta_ads",
  "other",
] as const;
export type ExpenseSource = (typeof expenseSources)[number];

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    category: text("category").notNull(),
    vendor: text("vendor"),
    description: text("description"),
    occurredAt: text("occurred_at").notNull(),
    source: text("source").notNull().default("manual"),
    // Used to dedup imports from external sources (bank/ads transaction id…).
    sourceRef: text("source_ref"),
    customFields: text("custom_fields"),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountOccurredIdx: index("expenses_account_occurred_idx").on(t.accountId, t.occurredAt),
    accountCategoryIdx: index("expenses_account_category_idx").on(t.accountId, t.category),
    sourceRefIdx: uniqueIndex("expenses_source_ref_idx").on(t.accountId, t.source, t.sourceRef),
  }),
);

export type AccountRow = typeof accounts.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type AgentActionRow = typeof agentActions.$inferSelect;
export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
