import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  dealCreateInputSchema,
  dealUpdateInputSchema,
  dealListFiltersSchema,
} from "../../contract/schemas/deal.js";
import { createDeal, getDeal, listDeals, updateDeal, deleteDeal } from "../../domain/deal.js";
import { readMutationOptions, parseOrThrow } from "../../api/helpers.js";

export const dealsRoute = new Hono();
dealsRoute.use("*", apiKeyAuth);

dealsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters = parseOrThrow(dealListFiltersSchema, {
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    contactId: c.req.query("contact_id"),
    stage: c.req.query("stage"),
    status: c.req.query("status"),
  });
  return c.json(wrap(await listDeals(auth, filters)));
});

dealsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(dealCreateInputSchema, raw);
  const result = await createDeal(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

dealsRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("deal").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid deal id", field: "id" });
  }
  return c.json(wrap({ deal: await getDeal(auth, id) }));
});

dealsRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("deal").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid deal id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const patch = parseOrThrow(dealUpdateInputSchema, raw);
  return c.json(wrap(await updateDeal(auth, id, patch, opts)));
});

dealsRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("deal").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid deal id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await deleteDeal(auth, id, opts)));
});
