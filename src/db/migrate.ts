import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

// Migrations run as a one-time local command, so we use the native node
// client (full SQLite support, can also talk to libsql:// over Hrana/WS).
// The serverless function never imports this file.

// Prefer TURSO_* (production-style) over DATABASE_URL so the local
// .env's file:./data/local.db doesn't shadow a remote target.
const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "file:./data/local.db";
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });
const db = drizzle(client);

async function main() {
  console.log(`Migrating against ${url.replace(/auth_token=.+/, "auth_token=…")}`);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  client.close();
  console.log("✔ migrations applied");
}

main().catch((err) => {
  console.error("✘ migration failed:", err);
  process.exit(1);
});
