#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  contactStatuses,
  identityKinds,
  interactionKinds,
  interactionDirections,
  dealStatuses,
  taskStatuses,
  taskPriorities,
} from "@/db/schema.js";
import { apiRequest, ApiClientError } from "@/cli/client.js";

const DEFAULT_API_URL = "http://localhost:3000";

function getConfig(): { apiUrl: string; token: string } {
  const token = process.env.SOCRM_API_KEY;
  if (!token) {
    throw new Error("SOCRM_API_KEY environment variable is required");
  }
  return {
    apiUrl: process.env.SOCRM_API_URL ?? DEFAULT_API_URL,
    token,
  };
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown) {
  let payload: { code: string; message: string; hint?: string; field?: string };
  if (err instanceof ApiClientError) {
    payload = { code: err.code, message: err.message };
    if (err.hint) payload.hint = err.hint;
    if (err.field) payload.field = err.field;
  } else {
    payload = { code: "INTERNAL", message: err instanceof Error ? err.message : String(err) };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: payload }, null, 2) }],
    isError: true,
  };
}

// Common shapes ─────────────────────────────────────────────────

const intentField = z
  .string()
  .optional()
  .describe(
    "Free-text describing why you are doing this. Recorded in the audit log for the human owner to review later.",
  );

const idemField = z
  .string()
  .optional()
  .describe("Idempotency key. Retrying with the same key returns the cached response.");

const dryRunField = z
  .boolean()
  .optional()
  .describe("If true, compute the result but do not persist anything.");

const contactStatusField = z.enum(contactStatuses).optional();

async function callApi(
  cfg: { apiUrl: string; token: string },
  path: string,
  reqOpts: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number>;
    intent?: string;
    idempotencyKey?: string;
    dryRun?: boolean;
  },
) {
  const headers: Record<string, string> = {};
  if (reqOpts.idempotencyKey) headers["Idempotency-Key"] = reqOpts.idempotencyKey;
  if (reqOpts.intent) headers["X-Agent-Intent"] = reqOpts.intent;
  const query = { ...(reqOpts.query ?? {}) } as Record<string, string | number>;
  if (reqOpts.dryRun) query.dry_run = "1";
  const opts: {
    method: typeof reqOpts.method;
    body?: unknown;
    headers: Record<string, string>;
    query?: Record<string, string | number>;
  } = { method: reqOpts.method, headers };
  if (reqOpts.body !== undefined) opts.body = reqOpts.body;
  if (Object.keys(query).length > 0) opts.query = query;
  return apiRequest<unknown>(cfg, path, opts);
}

async function main() {
  const cfg = getConfig();

  const server = new McpServer(
    { name: "socrm", version: "0.0.2" },
    {
      capabilities: { tools: {} },
      instructions: [
        "Solo Agentic CRM — full read/write access to the user's CRM.",
        "Every mutation (including destructive ones like delete and merge) is fully exposed.",
        "Safety primitives:",
        "  - Pass `intent` to leave a human-readable explanation in the audit log.",
        "  - Pass `dryRun: true` on destructive ops to preview what would change.",
        "  - Pass `idempotencyKey` for safe retries.",
        "Call `schema_describe` first if you need to discover capabilities.",
      ].join("\n"),
    },
  );

  // ── Discovery ────────────────────────────────────────────────
  server.registerTool(
    "schema_describe",
    {
      title: "Describe the contract",
      description:
        "Returns the full agent-facing contract: every operation, its input schema, and metadata (destructive? idempotent? supports dry-run?). Use this to bootstrap or audit capabilities.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await apiRequest<unknown>(cfg, "/v1/schema");
        return textResult(data);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Contact CRUD ────────────────────────────────────────────
  server.registerTool(
    "contact_create",
    {
      title: "Create contact",
      description: "Create a new contact. Attaches email/phone Identities automatically.",
      inputSchema: {
        name: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        status: contactStatusField,
        customFields: z.record(z.unknown()).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { name: a.name };
        if (a.email) body.email = a.email;
        if (a.phone) body.phone = a.phone;
        if (a.status) body.status = a.status;
        if (a.customFields) body.customFields = a.customFields;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/contacts", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_get",
    {
      title: "Get contact",
      description: "Fetch a contact and its identities by id.",
      inputSchema: { id: z.string().regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/) },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/contacts/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_list",
    {
      title: "List contacts",
      description: "List contacts with cursor pagination and filters.",
      inputSchema: {
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        status: contactStatusField,
        q: z.string().min(1).optional(),
        updatedSince: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string | number> = {};
        if (a.cursor) query.cursor = a.cursor;
        if (a.limit) query.limit = a.limit;
        if (a.status) query.status = a.status;
        if (a.q) query.q = a.q;
        if (a.updatedSince) query.updated_since = a.updatedSince;
        return textResult(await callApi(cfg, "/v1/contacts", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_update",
    {
      title: "Update contact",
      description: "Partially update a contact. Changing primaryEmail/phone attaches a new Identity.",
      inputSchema: {
        id: z.string().regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/),
        name: z.string().optional(),
        primaryEmail: z.string().email().nullable().optional(),
        primaryPhone: z.string().nullable().optional(),
        status: contactStatusField,
        customFields: z.record(z.unknown()).nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        if (a.name !== undefined) patch.name = a.name;
        if (a.primaryEmail !== undefined) patch.primaryEmail = a.primaryEmail;
        if (a.primaryPhone !== undefined) patch.primaryPhone = a.primaryPhone;
        if (a.status) patch.status = a.status;
        if (a.customFields !== undefined) patch.customFields = a.customFields;
        const opts: Parameters<typeof callApi>[2] = { method: "PATCH", body: patch };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/contacts/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_delete",
    {
      title: "Delete contact (destructive)",
      description:
        "Hard-delete a contact (cascades to identities). A snapshot is kept in the audit log so the human owner can review. Pass dryRun:true to preview.",
      inputSchema: {
        id: z.string().regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/contacts/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_merge",
    {
      title: "Merge contacts (destructive)",
      description:
        "Merge mergeId into keepId. Migrates non-conflicting identities and deletes the merge source. Pass dryRun:true to preview the plan.",
      inputSchema: {
        keepId: z.string().regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/),
        mergeId: z.string().regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = {
          method: "POST",
          body: { keepId: a.keepId, mergeId: a.mergeId },
        };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/contacts/merge", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Account ───────────────────────────────────────────────
  server.registerTool(
    "account_get",
    {
      title: "Get account",
      description: "Return the current account (the human owner this CRM serves).",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/account", { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "account_update",
    {
      title: "Update account",
      description: "Update account email or name.",
      inputSchema: {
        name: z.string().min(1).max(200).nullable().optional(),
        email: z.string().email().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        if (a.name !== undefined) patch.name = a.name;
        if (a.email !== undefined) patch.email = a.email;
        const opts: Parameters<typeof callApi>[2] = { method: "PATCH", body: patch };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/account", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── API keys ──────────────────────────────────────────────
  server.registerTool(
    "api_key_list",
    {
      title: "List API keys",
      description: "List all API keys for this account.",
      inputSchema: { includeRevoked: z.boolean().optional() },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.includeRevoked) query.include_revoked = "1";
        return textResult(await callApi(cfg, "/v1/api-keys", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "api_key_create",
    {
      title: "Create API key",
      description:
        "Issue a new API key for another agent or device. The plaintext token is returned once; save it.",
      inputSchema: {
        label: z.string().min(1).max(100),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body: { label: a.label } };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/api-keys", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "api_key_revoke",
    {
      title: "Revoke API key (destructive)",
      description:
        "Immediately revoke an API key. The owning agent loses access on its next call. Pass dryRun:true to confirm without action.",
      inputSchema: {
        id: z.string().regex(/^key_[0-9A-HJKMNP-TV-Z]{26}$/),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/api-keys/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Identity ──────────────────────────────────────────────
  server.registerTool(
    "identity_add",
    {
      title: "Add identity to contact",
      description:
        "Attach an additional channel identity (email, phone, telegram, whatsapp, linkedin, etc.) to an existing contact. If the same kind+value already belongs to a different contact, you get CONFLICT — use contact_merge first.",
      inputSchema: {
        contactId: z.string().regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/),
        kind: z.enum(identityKinds),
        value: z.string().min(1).max(500),
        confidence: z.number().int().min(0).max(100).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = {
          contactId: a.contactId,
          kind: a.kind,
          value: a.value,
        };
        if (a.confidence !== undefined) body.confidence = a.confidence;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/identities", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "identity_remove",
    {
      title: "Remove identity (destructive)",
      description:
        "Detach an identity from its contact. The contact is preserved. Pass dryRun:true to preview.",
      inputSchema: {
        id: z.string().regex(/^idy_[0-9A-HJKMNP-TV-Z]{26}$/),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/identities/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "identity_list",
    {
      title: "List identities",
      description: "List identities. Filter by contactId or by kind.",
      inputSchema: {
        contactId: z.string().optional(),
        kind: z.enum(identityKinds).optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.contactId) query.contact_id = a.contactId;
        if (a.kind) query.kind = a.kind;
        return textResult(await callApi(cfg, "/v1/identities", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_find_by_identity",
    {
      title: "Find contact by identity",
      description:
        "Look up a single contact by one of its identities. Faster and more reliable than searching by name/email. Returns the contact and the matched identity, or NOT_FOUND.",
      inputSchema: {
        kind: z.enum(identityKinds),
        value: z.string().min(1).max(500),
      },
    },
    async (a) => {
      try {
        return textResult(
          await callApi(cfg, "/v1/contacts/find", { method: "GET", query: { kind: a.kind, value: a.value } }),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Interactions ──────────────────────────────────────────
  server.registerTool(
    "interaction_create",
    {
      title: "Create interaction",
      description:
        "Create an Interaction (call, meeting, note, message, etc.). Either tied to a contact or standalone.",
      inputSchema: {
        contactId: z.string().regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/).optional(),
        kind: z.enum(interactionKinds),
        direction: z.enum(interactionDirections).optional(),
        source: z.string().max(200).optional(),
        subject: z.string().max(1000).optional(),
        body: z.string().max(100_000).optional(),
        metadata: z.record(z.unknown()).optional(),
        occurredAt: z.string().datetime().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { kind: a.kind };
        if (a.contactId) body.contactId = a.contactId;
        if (a.direction) body.direction = a.direction;
        if (a.source) body.source = a.source;
        if (a.subject) body.subject = a.subject;
        if (a.body) body.body = a.body;
        if (a.metadata) body.metadata = a.metadata;
        if (a.occurredAt) body.occurredAt = a.occurredAt;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/interactions", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "interaction_list",
    {
      title: "List interactions",
      description: "List interactions (the timeline). Filter by contact, kind, or since-date. Cursor pagination.",
      inputSchema: {
        contactId: z.string().optional(),
        kind: z.enum(interactionKinds).optional(),
        since: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        cursor: z.string().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string | number> = {};
        if (a.contactId) query.contact_id = a.contactId;
        if (a.kind) query.kind = a.kind;
        if (a.since) query.since = a.since;
        if (a.limit) query.limit = a.limit;
        if (a.cursor) query.cursor = a.cursor;
        return textResult(await callApi(cfg, "/v1/interactions", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "interaction_ingest_email",
    {
      title: "Ingest email",
      description:
        "Ingest a parsed email. Finds the contact by sender email identity (or creates one if missing), inserts an email Interaction tied to that contact, and records the audit trail in a single call. Pass createContactIfMissing:false to require an existing match.",
      inputSchema: {
        from: z.object({
          name: z.string().optional(),
          email: z.string().email(),
        }),
        to: z
          .array(
            z.object({
              name: z.string().optional(),
              email: z.string().email(),
            }),
          )
          .optional(),
        subject: z.string().max(1000).optional(),
        body: z.string().max(500_000).optional(),
        receivedAt: z.string().datetime().optional(),
        messageId: z.string().optional(),
        direction: z.enum(interactionDirections).optional(),
        source: z.string().optional(),
        createContactIfMissing: z.boolean().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { from: a.from };
        if (a.to) body.to = a.to;
        if (a.subject) body.subject = a.subject;
        if (a.body) body.body = a.body;
        if (a.receivedAt) body.receivedAt = a.receivedAt;
        if (a.messageId) body.messageId = a.messageId;
        if (a.direction) body.direction = a.direction;
        if (a.source) body.source = a.source;
        if (a.createContactIfMissing !== undefined) body.createContactIfMissing = a.createContactIfMissing;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/interactions/ingest/email", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "interaction_delete",
    {
      title: "Delete interaction (destructive but reversible)",
      description:
        "Hard-delete an interaction. The full row is captured in the action's metadata so action_undo can restore it.",
      inputSchema: {
        id: z.string().regex(/^int_[0-9A-HJKMNP-TV-Z]{26}$/),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/interactions/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Deals ─────────────────────────────────────────────────
  const contactIdRegex = /^cnt_[0-9A-HJKMNP-TV-Z]{26}$/;
  const dealIdRegex = /^dl_[0-9A-HJKMNP-TV-Z]{26}$/;
  const taskIdRegex = /^tsk_[0-9A-HJKMNP-TV-Z]{26}$/;
  const noteIdRegex = /^not_[0-9A-HJKMNP-TV-Z]{26}$/;
  const tagIdRegex = /^tag_[0-9A-HJKMNP-TV-Z]{26}$/;

  server.registerTool(
    "deal_create",
    {
      title: "Create deal",
      description: "Create a new deal (revenue opportunity). Optionally tied to a contact.",
      inputSchema: {
        title: z.string().min(1).max(200),
        contactId: z.string().regex(contactIdRegex).optional(),
        stage: z.string().min(1).max(50).optional(),
        status: z.enum(dealStatuses).optional(),
        value: z.number().int().nonnegative().optional(),
        currency: z.string().length(3).optional(),
        expectedCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { title: a.title };
        if (a.contactId) body.contactId = a.contactId;
        if (a.stage) body.stage = a.stage;
        if (a.status) body.status = a.status;
        if (a.value !== undefined) body.value = a.value;
        if (a.currency) body.currency = a.currency;
        if (a.expectedCloseDate) body.expectedCloseDate = a.expectedCloseDate;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/deals", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "deal_get",
    {
      title: "Get deal",
      description: "Fetch a deal by id.",
      inputSchema: { id: z.string().regex(dealIdRegex) },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/deals/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "deal_list",
    {
      title: "List deals",
      description: "List deals with cursor pagination and filters.",
      inputSchema: {
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        contactId: z.string().regex(contactIdRegex).optional(),
        stage: z.string().optional(),
        status: z.enum(dealStatuses).optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string | number> = {};
        if (a.cursor) query.cursor = a.cursor;
        if (a.limit) query.limit = a.limit;
        if (a.contactId) query.contact_id = a.contactId;
        if (a.stage) query.stage = a.stage;
        if (a.status) query.status = a.status;
        return textResult(await callApi(cfg, "/v1/deals", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "deal_update",
    {
      title: "Update deal",
      description: "Partially update a deal (title, stage, status, value, currency, expectedCloseDate, contact link).",
      inputSchema: {
        id: z.string().regex(dealIdRegex),
        title: z.string().min(1).max(200).optional(),
        contactId: z.string().regex(contactIdRegex).nullable().optional(),
        stage: z.string().min(1).max(50).optional(),
        status: z.enum(dealStatuses).optional(),
        value: z.number().int().nonnegative().nullable().optional(),
        currency: z.string().length(3).nullable().optional(),
        expectedCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        for (const f of ["title", "contactId", "stage", "status", "value", "currency", "expectedCloseDate"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) patch[f] = (a as Record<string, unknown>)[f];
        }
        const opts: Parameters<typeof callApi>[2] = { method: "PATCH", body: patch };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/deals/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "deal_delete",
    {
      title: "Delete deal (destructive)",
      description: "Hard-delete a deal. Snapshot is kept in the audit log for undo.",
      inputSchema: {
        id: z.string().regex(dealIdRegex),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/deals/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Tasks ─────────────────────────────────────────────────
  server.registerTool(
    "task_create",
    {
      title: "Create task",
      description: "Create a task. Tied optionally to a contact and/or deal.",
      inputSchema: {
        title: z.string().min(1).max(500),
        description: z.string().max(10_000).optional(),
        contactId: z.string().regex(contactIdRegex).optional(),
        dealId: z.string().regex(dealIdRegex).optional(),
        status: z.enum(taskStatuses).optional(),
        priority: z.enum(taskPriorities).optional(),
        dueAt: z.string().datetime().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { title: a.title };
        for (const f of ["description", "contactId", "dealId", "status", "priority", "dueAt"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) body[f] = (a as Record<string, unknown>)[f];
        }
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/tasks", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "task_get",
    { title: "Get task", description: "Fetch a task by id.", inputSchema: { id: z.string().regex(taskIdRegex) } },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/tasks/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "task_list",
    {
      title: "List tasks",
      description: "List tasks (filter by contactId, dealId, status, priority, dueBefore).",
      inputSchema: {
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        contactId: z.string().regex(contactIdRegex).optional(),
        dealId: z.string().regex(dealIdRegex).optional(),
        status: z.enum(taskStatuses).optional(),
        priority: z.enum(taskPriorities).optional(),
        dueBefore: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string | number> = {};
        if (a.cursor) query.cursor = a.cursor;
        if (a.limit) query.limit = a.limit;
        if (a.contactId) query.contact_id = a.contactId;
        if (a.dealId) query.deal_id = a.dealId;
        if (a.status) query.status = a.status;
        if (a.priority) query.priority = a.priority;
        if (a.dueBefore) query.due_before = a.dueBefore;
        return textResult(await callApi(cfg, "/v1/tasks", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "task_update",
    {
      title: "Update task",
      description: "Partially update a task. Transitioning status to/from 'done' auto-manages completedAt.",
      inputSchema: {
        id: z.string().regex(taskIdRegex),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(10_000).nullable().optional(),
        contactId: z.string().regex(contactIdRegex).nullable().optional(),
        dealId: z.string().regex(dealIdRegex).nullable().optional(),
        status: z.enum(taskStatuses).optional(),
        priority: z.enum(taskPriorities).optional(),
        dueAt: z.string().datetime().nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        for (const f of ["title", "description", "contactId", "dealId", "status", "priority", "dueAt"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) patch[f] = (a as Record<string, unknown>)[f];
        }
        const opts: Parameters<typeof callApi>[2] = { method: "PATCH", body: patch };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/tasks/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "task_delete",
    {
      title: "Delete task (destructive)",
      description: "Hard-delete a task. Snapshot kept for undo.",
      inputSchema: {
        id: z.string().regex(taskIdRegex),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/tasks/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Notes ─────────────────────────────────────────────────
  server.registerTool(
    "note_create",
    {
      title: "Create note",
      description: "Create a note. Attach optionally to a contact, a deal, or both, or standalone.",
      inputSchema: {
        body: z.string().min(1).max(500_000),
        title: z.string().max(500).optional(),
        contactId: z.string().regex(contactIdRegex).optional(),
        dealId: z.string().regex(dealIdRegex).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { body: a.body };
        for (const f of ["title", "contactId", "dealId"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) body[f] = (a as Record<string, unknown>)[f];
        }
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/notes", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "note_get",
    { title: "Get note", description: "Fetch a note by id.", inputSchema: { id: z.string().regex(noteIdRegex) } },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/notes/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "note_list",
    {
      title: "List notes",
      description: "List notes (filter by contact or deal).",
      inputSchema: {
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        contactId: z.string().regex(contactIdRegex).optional(),
        dealId: z.string().regex(dealIdRegex).optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string | number> = {};
        if (a.cursor) query.cursor = a.cursor;
        if (a.limit) query.limit = a.limit;
        if (a.contactId) query.contact_id = a.contactId;
        if (a.dealId) query.deal_id = a.dealId;
        return textResult(await callApi(cfg, "/v1/notes", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "note_update",
    {
      title: "Update note",
      description: "Partially update a note (body, title, contact/deal link).",
      inputSchema: {
        id: z.string().regex(noteIdRegex),
        body: z.string().min(1).max(500_000).optional(),
        title: z.string().max(500).nullable().optional(),
        contactId: z.string().regex(contactIdRegex).nullable().optional(),
        dealId: z.string().regex(dealIdRegex).nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        for (const f of ["body", "title", "contactId", "dealId"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) patch[f] = (a as Record<string, unknown>)[f];
        }
        const opts: Parameters<typeof callApi>[2] = { method: "PATCH", body: patch };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/notes/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "note_delete",
    {
      title: "Delete note (destructive)",
      description: "Hard-delete a note. Snapshot kept for undo.",
      inputSchema: {
        id: z.string().regex(noteIdRegex),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/notes/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Tags ──────────────────────────────────────────────────
  server.registerTool(
    "tag_create",
    {
      title: "Create tag",
      description: "Create a tag (unique name per account, optional hex color).",
      inputSchema: {
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { name: a.name };
        if (a.color) body.color = a.color;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/tags", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "tag_list",
    { title: "List tags", description: "List all tags for the account.", inputSchema: {} },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/tags", { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "tag_update",
    {
      title: "Update tag",
      description: "Rename a tag or change its color.",
      inputSchema: {
        id: z.string().regex(tagIdRegex),
        name: z.string().min(1).max(50).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        if (a.name !== undefined) patch.name = a.name;
        if (a.color !== undefined) patch.color = a.color;
        const opts: Parameters<typeof callApi>[2] = { method: "PATCH", body: patch };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/tags/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "tag_delete",
    {
      title: "Delete tag (destructive)",
      description:
        "Hard-delete a tag. Cascade-detaches from all contacts. Undo re-creates the tag AND re-attaches to all linked contacts.",
      inputSchema: {
        id: z.string().regex(tagIdRegex),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "DELETE" };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/tags/${a.id}`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "tag_attach",
    {
      title: "Attach tag to contact",
      description: "Attach a tag to a contact. If already attached, returns a no-op with alreadyAttached:true.",
      inputSchema: {
        contactId: z.string().regex(contactIdRegex),
        tagId: z.string().regex(tagIdRegex),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = {
          method: "POST",
          body: { contactId: a.contactId, tagId: a.tagId },
        };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/tags/attach", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "tag_detach",
    {
      title: "Detach tag from contact",
      description: "Detach a tag from a contact.",
      inputSchema: {
        contactId: z.string().regex(contactIdRegex),
        tagId: z.string().regex(tagIdRegex),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = {
          method: "POST",
          body: { contactId: a.contactId, tagId: a.tagId },
        };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/tags/detach", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "tag_list_for_contact",
    {
      title: "List tags attached to a contact",
      description: "Returns the set of tags currently attached to a given contact.",
      inputSchema: { contactId: z.string().regex(contactIdRegex) },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/tags/for-contact/${a.contactId}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Audit ─────────────────────────────────────────────────
  server.registerTool(
    "action_get",
    {
      title: "Get audit action",
      description:
        "Fetch a single action by id, including its full metadata. Use this to inspect what an earlier mutation did before calling action_undo.",
      inputSchema: { id: z.string().regex(/^act_[0-9A-HJKMNP-TV-Z]{26}$/) },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/actions/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "action_undo",
    {
      title: "Undo a previous action (destructive)",
      description:
        "Reverse a previously-recorded mutation using the snapshot stored in its metadata. Works for: contact.create/update/delete, identity.add/remove, account.update, api_key.create/revoke, interaction.create/delete/ingest_email. Returns CONFLICT for contact.merge (one-way) and action.undo itself. Always supports dryRun:true to preview the reversal.",
      inputSchema: {
        id: z.string().regex(/^act_[0-9A-HJKMNP-TV-Z]{26}$/),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body: {} };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, `/v1/actions/${a.id}/undo`, opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "action_list",
    {
      title: "List agent actions",
      description: "Inspect what agents (including you) have done in this CRM. Use to audit recent activity.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
        apiKeyId: z.string().optional(),
        targetKind: z.string().optional(),
        targetId: z.string().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string | number> = {};
        if (a.limit) query.limit = a.limit;
        if (a.apiKeyId) query.api_key_id = a.apiKeyId;
        if (a.targetKind) query.target_kind = a.targetKind;
        if (a.targetId) query.target_id = a.targetId;
        return textResult(await callApi(cfg, "/v1/actions", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`socrm-mcp fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
