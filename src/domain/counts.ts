import { count, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  contacts,
  identities,
  interactions,
  deals,
  tasks,
  notes,
  tags,
  agentActions,
  apiKeys,
} from "../db/schema.js";
import type { CallerContext } from "./shared.js";

/** Per-tenant entity counts, for the overview dashboard. */
export async function getAccountCounts(ctx: CallerContext) {
  const [c, i, ix, d, t, n, tg, a, k] = await Promise.all([
    db.select({ n: count() }).from(contacts).where(eq(contacts.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(identities).where(eq(identities.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(interactions).where(eq(interactions.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(deals).where(eq(deals.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(tasks).where(eq(tasks.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(notes).where(eq(notes.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(tags).where(eq(tags.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(agentActions).where(eq(agentActions.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(apiKeys).where(eq(apiKeys.accountId, ctx.accountId)).then((r) => r[0]?.n ?? 0),
  ]);
  return {
    contacts: c,
    identities: i,
    interactions: ix,
    deals: d,
    tasks: t,
    notes: n,
    tags: tg,
    actions: a,
    apiKeys: k,
  };
}
