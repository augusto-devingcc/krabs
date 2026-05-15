import { Hono } from "hono";
import { z } from "zod";
import { apiKeyAuth } from "@/api/middleware/auth.js";
import { wrap } from "@/contract/envelope.js";
import { ApiError } from "@/contract/errors.js";
import { contactCreateInputSchema } from "@/contract/schemas/contact.js";
import { createContact, getContact } from "@/domain/contact.js";
import { idSchema } from "@/contract/ids.js";

export const contactsRoute = new Hono();

contactsRoute.use("*", apiKeyAuth);

contactsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const idempotencyKey = c.req.header("idempotency-key") ?? undefined;
  const intent = c.req.header("x-agent-intent") ?? undefined;
  const dryRun = c.req.query("dry_run") === "1" || c.req.query("dry_run") === "true";

  const rawBody = await c.req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }

  const parsed = contactCreateInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path.join(".");
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: first?.message ?? "Validation failed",
      ...(field ? { field } : {}),
    });
  }

  const opts: { idempotencyKey?: string; intent?: string; dryRun: boolean } = { dryRun };
  if (idempotencyKey) opts.idempotencyKey = idempotencyKey;
  if (intent) opts.intent = intent;
  const result = await createContact(auth, parsed.data, opts);

  const status = result.replayed ? 200 : 201;
  return c.json(wrap(result), status);
});

contactsRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const idCheck = idSchema("contact").safeParse(id);
  if (!idCheck.success) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Invalid contact id format",
      field: "id",
    });
  }
  const result = await getContact(auth, id);
  return c.json(wrap(result));
});

export const actionsRoute = new Hono();

actionsRoute.use("*", apiKeyAuth);

const listActionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  api_key_id: z.string().optional(),
  target_kind: z.string().optional(),
  target_id: z.string().optional(),
});

actionsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const parsed = listActionsQuerySchema.safeParse({
    limit: c.req.query("limit"),
    api_key_id: c.req.query("api_key_id"),
    target_kind: c.req.query("target_kind"),
    target_id: c.req.query("target_id"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path.join(".");
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: first?.message ?? "Invalid query",
      ...(field ? { field } : {}),
    });
  }

  const { listActions } = await import("@/domain/contact.js");
  const opts: {
    limit?: number;
    apiKeyId?: string;
    targetKind?: string;
    targetId?: string;
  } = {};
  if (parsed.data.limit !== undefined) opts.limit = parsed.data.limit;
  if (parsed.data.api_key_id !== undefined) opts.apiKeyId = parsed.data.api_key_id;
  if (parsed.data.target_kind !== undefined) opts.targetKind = parsed.data.target_kind;
  if (parsed.data.target_id !== undefined) opts.targetId = parsed.data.target_id;
  const items = await listActions(auth, opts);
  return c.json(wrap({ items }));
});
