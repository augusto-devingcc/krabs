import { createRequire } from "module";
import { createClient as createWebClient, type Client } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

// Prefer the Vercel Marketplace Turso integration's auto-provisioned vars;
// fall back to our local convention. This prevents a local .env's file URL
// from accidentally shadowing a production target.
const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "file:./data/local.db";
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;

const clientConfig: { url: string; authToken?: string } = { url };
if (authToken) clientConfig.authToken = authToken;

const isRemote =
  url.startsWith("libsql://") ||
  url.startsWith("https://") ||
  url.startsWith("http://");

// In production (remote Turso) use the pure-HTTP client — no native binding.
// For local dev/tests with file: URLs, load the full node client via
// createRequire so we stay synchronous (no top-level await) and the
// serverless bundle still never has to resolve native deps.
let client: Client;
if (isRemote) {
  client = createWebClient(clientConfig);
} else {
  const localRequire = createRequire(import.meta.url);
  const mod = localRequire("@libsql/client") as typeof import("@libsql/client");
  client = mod.createClient(clientConfig);
}

export const libsql: Client = client;
export const db = drizzle(libsql, { schema });
export type Db = typeof db;
