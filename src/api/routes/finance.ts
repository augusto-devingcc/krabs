import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import {
  getFinanceSummary,
  getMrrBreakdown,
  getExpensesByCategory,
} from "../../domain/finance.js";

export const financeRoute = new Hono();
financeRoute.use("*", apiKeyAuth);

financeRoute.get("/summary", async (c) => {
  const auth = c.get("auth");
  const range: { from?: string; to?: string } = {};
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (from) range.from = from;
  if (to) range.to = to;
  return c.json(wrap(await getFinanceSummary(auth, range)));
});

financeRoute.get("/mrr", async (c) => {
  const auth = c.get("auth");
  return c.json(wrap(await getMrrBreakdown(auth)));
});

financeRoute.get("/expenses-by-category", async (c) => {
  const auth = c.get("auth");
  const range: { from?: string; to?: string } = {};
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (from) range.from = from;
  if (to) range.to = to;
  return c.json(wrap(await getExpensesByCategory(auth, range)));
});
