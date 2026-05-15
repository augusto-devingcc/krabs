import { sql } from "drizzle-orm";
import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    // sha256(plaintext) — hex encoded
    tokenHash: text("token_hash").notNull().unique(),
    // first 12 chars of plaintext for display ("crm_live_abc...")
    tokenPreview: text("token_preview").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => ({
    accountIdx: index("api_keys_account_idx").on(table.accountId),
    hashIdx: index("api_keys_hash_idx").on(table.tokenHash),
  }),
);

export type AccountRow = typeof accounts.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
