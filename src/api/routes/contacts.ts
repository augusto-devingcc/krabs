import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import {
  contactCreateInputSchema,
  contactUpdateInputSchema,
  contactListFiltersSchema,
} from "../../contract/schemas/contact.js";
import { idSchema } from "../../contract/ids.js";
import {
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  mergeContacts,
  listActions,
} from "../../domain/contact.js";
import { readMutationOptions, parseOrThrow } from "../../api/helpers.js";
import { attachContactsImportExport } from "../../api/routes/import-export.js";

export const contactsRoute = new Hono();
contactsRoute.use("*", apiKeyAuth);

// Attach /import, /ingest/vcard and /export.csv BEFORE the /:id routes so
// literal segments take priority over the parameterized matcher.
attachContactsImportExport(contactsRoute);

// LIST
contactsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters = parseOrThrow(contactListFiltersSchema, {
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    status: c.req.query("status"),
    q: c.req.query("q"),
    updatedSince: c.req.query("updated_since"),
  });
  const result = await listContacts(auth, filters);
  return c.json(wrap(result));
});

// CREATE
contactsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(contactCreateInputSchema, raw);
  const result = await createContact(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

// MERGE — defined before /:id to avoid route collision
contactsRoute.post("/merge", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const body = raw as { keepId?: unknown; mergeId?: unknown };
  if (typeof body.keepId !== "string" || typeof body.mergeId !== "string") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "keepId and mergeId are required" });
  }
  idSchema("contact").parse(body.keepId);
  idSchema("contact").parse(body.mergeId);
  const result = await mergeContacts(auth, { keepId: body.keepId, mergeId: body.mergeId }, opts);
  return c.json(wrap(result), result.replayed ? 200 : 200);
});

// GET
contactsRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("contact").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid contact id", field: "id" });
  }
  const result = await getContact(auth, id);
  return c.json(wrap(result));
});

// UPDATE
contactsRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("contact").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid contact id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const patch = parseOrThrow(contactUpdateInputSchema, raw);
  const result = await updateContact(auth, id, patch, opts);
  return c.json(wrap(result));
});

// DELETE
contactsRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("contact").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid contact id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const result = await deleteContact(auth, id, opts);
  return c.json(wrap(result));
});

// ACTIONS
import { getAction, undoAction } from "../../domain/action.js";

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
