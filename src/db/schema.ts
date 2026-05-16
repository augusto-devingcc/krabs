import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    clerkUserId: text("clerk_user_id"),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    clerkUserIdx: uniqueIndex("accounts_clerk_user_id_idx").on(t.clerkUserId),
  }),
);

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

export const contactStatuses = ["lead", "prospect", "customer", "archived"] as const;
export type ContactStatus = (typeof contactStatuses)[number];

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    primaryEmail: text("primary_email"),
    primaryPhone: text("primary_phone"),
    status: text("status").notNull().default("lead"),
    // JSON object as TEXT
    customFields: text("custom_fields"),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountIdx: index("contacts_account_idx").on(t.accountId),
    accountEmailIdx: index("contacts_account_email_idx").on(t.accountId, t.primaryEmail),
  }),
);

export const identityKinds = [
  "email",
  "phone",
  "whatsapp",
  "telegram",
  "linkedin",
  "twitter",
  "instagram",
  "other",
] as const;
export type IdentityKind = (typeof identityKinds)[number];

export const identities = sqliteTable(
  "identities",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    confidence: integer("confidence").notNull().default(100),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    contactIdx: index("identities_contact_idx").on(t.contactId),
    accountKindValueIdx: uniqueIndex("identities_account_kind_value_idx").on(
      t.accountId,
      t.kind,
      t.value,
    ),
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
    // JSON: structured metadata (e.g. snapshot of deleted entity, merge plan)
    metadata: text("metadata"),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountCreatedIdx: index("agent_actions_account_created_idx").on(t.accountId, t.createdAt),
    targetIdx: index("agent_actions_target_idx").on(t.targetKind, t.targetId),
    actorIdx: index("agent_actions_actor_idx").on(t.apiKeyId),
  }),
);

export const interactionKinds = [
  "email_in",
  "email_out",
  "call",
  "meeting",
  "message",
  "note",
  "agent_log",
  "custom",
] as const;
export type InteractionKind = (typeof interactionKinds)[number];

export const interactionDirections = ["inbound", "outbound", "internal"] as const;
export type InteractionDirection = (typeof interactionDirections)[number];

export const interactions = sqliteTable(
  "interactions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    direction: text("direction"),
    source: text("source"),
    subject: text("subject"),
    body: text("body"),
    metadata: text("metadata"),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountOccurredIdx: index("interactions_account_occurred_idx").on(t.accountId, t.occurredAt),
    contactOccurredIdx: index("interactions_contact_occurred_idx").on(t.contactId, t.occurredAt),
    kindIdx: index("interactions_kind_idx").on(t.accountId, t.kind),
  }),
);

export const dealStages = ["new", "qualified", "proposal", "negotiation", "closed"] as const;
export const dealStatuses = ["open", "won", "lost"] as const;
export type DealStatus = (typeof dealStatuses)[number];

export const deals = sqliteTable(
  "deals",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    stage: text("stage").notNull().default("new"),
    status: text("status").notNull().default("open"),
    value: integer("value"),
    currency: text("currency"),
    expectedCloseDate: text("expected_close_date"),
    customFields: text("custom_fields"),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountIdx: index("deals_account_idx").on(t.accountId),
    contactIdx: index("deals_contact_idx").on(t.contactId),
    stageIdx: index("deals_account_stage_idx").on(t.accountId, t.stage),
  }),
);

export const taskStatuses = ["open", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const taskPriorities = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    dueAt: text("due_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountStatusIdx: index("tasks_account_status_idx").on(t.accountId, t.status),
    contactIdx: index("tasks_contact_idx").on(t.contactId),
    dealIdx: index("tasks_deal_idx").on(t.dealId),
    dueIdx: index("tasks_due_idx").on(t.accountId, t.dueAt),
  }),
);

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
    title: text("title"),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(nowDefault),
    updatedAt: text("updated_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountIdx: index("notes_account_idx").on(t.accountId),
    contactIdx: index("notes_contact_idx").on(t.contactId),
    dealIdx: index("notes_deal_idx").on(t.dealId),
  }),
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    accountNameIdx: uniqueIndex("tags_account_name_idx").on(t.accountId, t.name),
  }),
);

export const contactTags = sqliteTable(
  "contact_tags",
  {
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(nowDefault),
  },
  (t) => ({
    pk: uniqueIndex("contact_tags_pk").on(t.contactId, t.tagId),
    tagIdx: index("contact_tags_tag_idx").on(t.tagId),
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
// Financial primitives (Phase A): products, subscriptions, invoices, expenses.
// All money is stored as integer cents to avoid float drift. Currency defaults
// to USD per row but is overridable. MRR is denormalized on subscriptions for
// O(1) aggregate queries.
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
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
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
    contactIdx: index("subs_contact_idx").on(t.contactId),
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
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
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
    contactIdx: index("invoices_contact_idx").on(t.contactId),
    subscriptionIdx: index("invoices_subscription_idx").on(t.subscriptionId),
    dealIdx: index("invoices_deal_idx").on(t.dealId),
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
    // Used to dedup imports from external sources (stripe charge id, ads transaction id…).
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

export type ProductRow = typeof products.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;

export const deviceAuthorizationStatuses = ["pending", "approved", "denied", "expired"] as const;
export type DeviceAuthorizationStatus = (typeof deviceAuthorizationStatuses)[number];

export const deviceAuthorizations = sqliteTable(
  "device_authorizations",
  {
    id: text("id").primaryKey(),
    deviceCode: text("device_code").notNull().unique(),
    userCode: text("user_code").notNull().unique(),
    // Null until approved (we don't know which account until human approves).
    accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    // pending | approved | denied | expired
    status: text("status").notNull().default("pending"),
    // JSON: { clientName, userAgent, ip } — what the agent told us about itself.
    clientMeta: text("client_meta"),
    // The api_key row created on approval. Null while pending/denied/expired.
    approvedApiKeyId: text("approved_api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(nowDefault),
    expiresAt: text("expires_at").notNull(),
    approvedAt: text("approved_at"),
  },
  (t) => ({
    statusIdx: index("device_authorizations_status_idx").on(t.status),
    expiresIdx: index("device_authorizations_expires_idx").on(t.expiresAt),
  }),
);

export type DeviceAuthorizationRow = typeof deviceAuthorizations.$inferSelect;

export type AccountRow = typeof accounts.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type IdentityRow = typeof identities.$inferSelect;
export type AgentActionRow = typeof agentActions.$inferSelect;
export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type InteractionRow = typeof interactions.$inferSelect;
export type DealRow = typeof deals.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type TagRow = typeof tags.$inferSelect;
export type ContactTagRow = typeof contactTags.$inferSelect;
