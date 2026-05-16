import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  createExpense,
  getExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
} from "../../domain/expense.js";
import { readMutationOptions } from "../../api/helpers.js";

export const expensesRoute = new Hono();
expensesRoute.use("*", apiKeyAuth);

expensesRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters: {
    category?: string;
    vendor?: string;
    source?: string;
    from?: string;
    to?: string;
  } = {};
  const category = c.req.query("category");
  const vendor = c.req.query("vendor");
  const source = c.req.query("source");
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (category) filters.category = category;
  if (vendor) filters.vendor = vendor;
  if (source) filters.source = source;
  if (from) filters.from = from;
  if (to) filters.to = to;
  return c.json(wrap(await listExpenses(auth, filters as Parameters<typeof listExpenses>[1])));
});

expensesRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const result = await createExpense(auth, raw as Parameters<typeof createExpense>[1], opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

expensesRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("expense").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid expense id", field: "id" });
  }
  return c.json(wrap({ expense: await getExpense(auth, id) }));
});

expensesRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("expense").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid expense id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  return c.json(wrap(await updateExpense(auth, id, raw as Parameters<typeof updateExpense>[2], opts)));
});

expensesRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("expense").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid expense id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await deleteExpense(auth, id, opts)));
});
