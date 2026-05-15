import { Hono } from "hono";
import { apiKeyAuth } from "@/api/middleware/auth.js";
import { wrap } from "@/contract/envelope.js";
import { ApiError } from "@/contract/errors.js";
import {
  interactionCreateInputSchema,
  interactionListFiltersSchema,
  emailIngestInputSchema,
} from "@/contract/schemas/interaction.js";
import {
  createInteraction,
  listInteractions,
  ingestEmail,
  deleteInteraction,
} from "@/domain/interaction.js";
import { idSchema } from "@/contract/ids.js";
import { readMutationOptions, parseOrThrow } from "@/api/helpers.js";

export const interactionsRoute = new Hono();
interactionsRoute.use("*", apiKeyAuth);

interactionsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters = parseOrThrow(interactionListFiltersSchema, {
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    contactId: c.req.query("contact_id"),
    kind: c.req.query("kind"),
    since: c.req.query("since"),
  });
  const result = await listInteractions(auth, filters);
  return c.json(wrap(result));
});

interactionsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(interactionCreateInputSchema, raw);
  const result = await createInteraction(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

interactionsRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("interaction").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid interaction id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const result = await deleteInteraction(auth, id, opts);
  return c.json(wrap(result));
});

interactionsRoute.post("/ingest/email", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(emailIngestInputSchema, raw);
  const result = await ingestEmail(auth, data, opts);
  const status = result.replayed ? 200 : result.contactCreated ? 201 : 200;
  return c.json(wrap(result), status);
});
