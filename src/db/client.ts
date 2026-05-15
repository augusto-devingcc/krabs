import { createClient as createWebClient, type Client } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

// Accept either our local convention or the names auto-provisioned by the
// Vercel Marketplace Turso Cloud integration.
const url =
  process.env.DATABASE_URL ??
  process.env.TURSO_DATABASE_URL ??
  "file:./data/local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

const clientConfig: { url: string; authToken?: string } = { url };
if (authToken) clientConfig.authToken = authToken;

const isRemote =
  url.startsWith("libsql://") ||
  url.startsWith("https://") ||
  url.startsWith("http://");

// In production (remote Turso) use the pure-HTTP client — no native binding.
// For local dev/tests with file: URLs, dynamically import the full node
// client so the serverless bundle never has to resolve native deps.
let client: Client;
if (isRemote) {
  client = createWebClient(clientConfig);
} else {
  const mod = await import("@libsql/client");
  client = mod.createClient(clientConfig);
}

export const libsql: Client = client;
export const db = drizzle(libsql, { schema });
export type Db = typeof db;
