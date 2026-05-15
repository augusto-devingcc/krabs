import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { idSchema } from "../../contract/ids.js";
import {
  noteCreateInputSchema,
  noteUpdateInputSchema,
  noteListFiltersSchema,
} from "../../contract/schemas/note.js";
import { createNote, getNote, listNotes, updateNote, deleteNote } from "../../domain/note.js";
import { readMutationOptions, parseOrThrow } from "../../api/helpers.js";

export const notesRoute = new Hono();
notesRoute.use("*", apiKeyAuth);

notesRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const filters = parseOrThrow(noteListFiltersSchema, {
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    contactId: c.req.query("contact_id"),
    dealId: c.req.query("deal_id"),
  });
  return c.json(wrap(await listNotes(auth, filters)));
});

notesRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(noteCreateInputSchema, raw);
  const result = await createNote(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

notesRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("note").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid note id", field: "id" });
  }
  return c.json(wrap({ note: await getNote(auth, id) }));
});

notesRoute.patch("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("note").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid note id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const patch = parseOrThrow(noteUpdateInputSchema, raw);
  return c.json(wrap(await updateNote(auth, id, patch, opts)));
});

notesRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("note").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid note id", field: "id" });
  }
  const opts = readMutationOptions(c);
  return c.json(wrap(await deleteNote(auth, id, opts)));
});
