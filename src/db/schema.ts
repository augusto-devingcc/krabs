import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

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
