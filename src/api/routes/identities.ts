import { Hono } from "hono";
import { apiKeyAuth } from "@/api/middleware/auth.js";
import { wrap } from "@/contract/envelope.js";
import { ApiError } from "@/contract/errors.js";
import { idSchema } from "@/contract/ids.js";
import {
  identityAddInputSchema,
  identityFindInputSchema,
} from "@/contract/schemas/identity.js";
import {
  addIdentity,
  removeIdentity,
  listIdentities,
  findContactByIdentity,
} from "@/domain/identity.js";
import { readMutationOptions, parseOrThrow } from "@/api/helpers.js";

export const identitiesRoute = new Hono();
identitiesRoute.use("*", apiKeyAuth);

identitiesRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const opts: { contactId?: string; kind?: string } = {};
  const contactId = c.req.query("contact_id");
  const kind = c.req.query("kind");
  if (contactId) opts.contactId = contactId;
  if (kind) opts.kind = kind;
  const result = await listIdentities(auth, opts);
  return c.json(wrap(result));
});

identitiesRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(identityAddInputSchema, raw);
  const result = await addIdentity(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

identitiesRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("identity").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid identity id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const result = await removeIdentity(auth, id, opts);
  return c.json(wrap(result));
});

// Contact lookup by identity — mounted under /v1/contacts/find via app.ts
export const contactFindRoute = new Hono();
contactFindRoute.use("*", apiKeyAuth);

contactFindRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const kind = c.req.query("kind");
  const value = c.req.query("value");
  const parsed = parseOrThrow(identityFindInputSchema, { kind, value });
  const result = await findContactByIdentity(auth, parsed.kind, parsed.value);
  if (!result) {
    throw new ApiError({
      code: "NOT_FOUND",
      message: `No contact has ${parsed.kind} = ${parsed.value}`,
    });
  }
  return c.json(wrap(result));
});
