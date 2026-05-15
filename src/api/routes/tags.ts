import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  tagCreateInputSchema,
  tagUpdateInputSchema,
  tagAttachInputSchema,
} from "../../contract/schemas/tag.js";
import {
  createTag,
  getTag,
  listTags,
  updateTag,
  deleteTag,
  attachTag,
  detachTag,
  listTagsForContact,
} from "../../domain/tag.js";
import { readMutationOptions, parseOrThrow } from "../../api/helpers.js";

export const tagsRoute = new Hono();
tagsRoute.use("*", apiKeyAuth);

tagsRoute.get("/", async (c) => {
  return c.json(wrap(await listTags(c.get("auth"))));
});

tagsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(tagCreateInputSchema, raw);
  const result = await createTag(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

// Attach / detach — define BEFORE /:id routes
tagsRoute.post("/attach", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(tagAttachInputSchema, raw);
  const result = await attachTag(auth, data, opts);
  const status = result.alreadyAttached ? 200 : 201;
  return c.json(wrap(result), status);
});

tagsRoute.post("/detach", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(tagAttachInputSchema, raw);
  return c.json(wrap(await detachTag(auth, data, opts)));
});

tagsRoute.get("/for-contact/:contactId", async (c) => {
  const auth = c.get("auth");
  const cid = c.req.param("contactId");
  if (!idSchema("contact").safeParse(cid).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid contact id", field: "contactId" });
  }
  return c.json(wrap(await listTagsForContact(auth, cid)));
});

tagsRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("tag").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid tag id", field: "id" });
  }
  return c.json(wrap({ tag: await getTag(auth, id) }));
});

tagsRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("tag").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid tag id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const patch = parseOrThrow(tagUpdateInputSchema, raw);
  return c.json(wrap(await updateTag(auth, id, patch, opts)));
});

tagsRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("tag").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid tag id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await deleteTag(auth, id, opts)));
});
