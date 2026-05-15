import { createClient, type Client } from "@libsql/client";
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

export const libsql: Client = createClient(clientConfig);
export const db = drizzle(libsql, { schema });
export type Db = typeof db;
