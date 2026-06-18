import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import { getAction, undoAction, listActions } from "../../domain/action.js";
import { readMutationOptions } from "../../api/helpers.js";

export const actionsRoute = new Hono();
actionsRoute.use("*", apiKeyAuth);

actionsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const limit = c.req.query("limit");
  const apiKeyId = c.req.query("api_key_id");
  const targetKind = c.req.query("target_kind");
  const targetId = c.req.query("target_id");
  const opts: { limit?: number; apiKeyId?: string; targetKind?: string; targetId?: string } = {};
  if (limit) opts.limit = Number(limit);
  if (apiKeyId) opts.apiKeyId = apiKeyId;
  if (targetKind) opts.targetKind = targetKind;
  if (targetId) opts.targetId = targetId;
  const items = await listActions(auth, opts);
  return c.json(wrap({ items }));
});

actionsRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("agentAction").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid action id", field: "id" });
  }
  const result = await getAction(auth, id);
  return c.json(wrap(result));
});

actionsRoute.post("/:id/undo", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("agentAction").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid action id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const result = await undoAction(auth, id, opts);
  return c.json(wrap(result));
});
