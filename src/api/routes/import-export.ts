import type { Hono } from "hono";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import {
  contactImportCsvInputSchema,
  vcardIngestInputSchema,
  exportAccountFiltersSchema,
} from "../../contract/schemas/import-export.js";
import {
  importContactsCsv,
  ingestVCard,
  exportAccount,
  exportContactsCsv,
} from "../../domain/import-export.js";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { readMutationOptions, parseOrThrow } from "../../api/helpers.js";

/** Adds /import, /ingest/vcard and /export.csv to the contacts router. MUST be called BEFORE /:id routes are registered. */
export function attachContactsImportExport(contactsRoute: Hono): void {
  contactsRoute.post("/import", apiKeyAuth, async (c) => {
    const auth = c.get("auth");
    const opts = readMutationOptions(c);
    const contentType = c.req.header("content-type") ?? "";
    let payload: Record<string, unknown>;
    if (contentType.includes("text/csv") || contentType.startsWith("text/plain")) {
      const csv = await c.req.text();
      payload = { csv };
    } else {
      const raw = await c.req.json().catch(() => null);
      if (!raw || typeof raw !== "object") {
        throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be JSON or text/csv" });
      }
      payload = raw as Record<string, unknown>;
    }
    const data = parseOrThrow(contactImportCsvInputSchema, payload);
    const result = await importContactsCsv(auth, data, opts);
    return c.json(wrap(result));
  });

  contactsRoute.post("/ingest/vcard", apiKeyAuth, async (c) => {
    const auth = c.get("auth");
    const opts = readMutationOptions(c);
    const contentType = c.req.header("content-type") ?? "";
    let payload: Record<string, unknown>;
    if (
      contentType.includes("text/vcard") ||
      contentType.includes("text/x-vcard") ||
      contentType.startsWith("text/plain")
    ) {
      const vcard = await c.req.text();
      payload = { vcard };
    } else {
      const raw = await c.req.json().catch(() => null);
      if (!raw || typeof raw !== "object") {
        throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be JSON or text/vcard" });
      }
      payload = raw as Record<string, unknown>;
    }
    const data = parseOrThrow(vcardIngestInputSchema, payload);
    const result = await ingestVCard(auth, data, opts);
    return c.json(wrap(result), result.contactCreated && !result.replayed ? 201 : 200);
  });

  contactsRoute.get("/export.csv", apiKeyAuth, async (c) => {
    const auth = c.get("auth");
    const filters: { status?: string; since?: string } = {};
    const status = c.req.query("status");
    const since = c.req.query("since");
    if (status) filters.status = status;
    if (since) filters.since = since;
    const csv = await exportContactsCsv(auth, filters);
    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts.csv"`,
    });
  });
}

export function attachAccountExport(accountRoute: Hono): void {
  accountRoute.get("/export", apiKeyAuth, async (c) => {
    const auth = c.get("auth");
    const filters = parseOrThrow(exportAccountFiltersSchema, {
      since: c.req.query("since"),
      includeActions: c.req.query("include_actions") === "0" ? false : undefined,
    });
    const result = await exportAccount(auth, filters);
    return c.json(wrap(result));
  });
}
