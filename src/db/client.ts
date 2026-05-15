// Use the pure-HTTP client variant so deployments without native bindings
// (e.g. Vercel serverless functions installed with --ignore-scripts) work.
// For local SQLite files we fall back to the default node client at the
// bottom of this module.
import { createClient as createWebClient } from "@libsql/client/web";
import { createClient as createNodeClient, type Client } from "@libsql/client";
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

// HTTP/libsql:// URLs use the web client (no native bindings).
// file: URLs (local dev/tests) need the node client which can talk to SQLite files.
const isRemote = url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://");
export const libsql: Client = isRemote ? createWebClient(clientConfig) : createNodeClient(clientConfig);
export const db = drizzle(libsql, { schema });
export type Db = typeof db;
