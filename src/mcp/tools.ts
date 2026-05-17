import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  contactStatuses,
  identityKinds,
  interactionKinds,
  interactionDirections,
  dealStatuses,
  taskStatuses,
  taskPriorities,
} from "../db/schema.js";
import { apiRequest, ApiClientError } from "../cli/client.js";

export type KrabsMcpConfig = { apiUrl: string; token: string };

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
  cfg: KrabsMcpConfig,
  path: string,
  reqOpts: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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

const MCP_INSTRUCTIONS = [
  "krabs.dev — full read/write access to the user's CRM.",
  "Every mutation (including destructive ones like delete and merge) is fully exposed.",
  "Safety primitives:",
  "  - Pass `intent` to leave a human-readable explanation in the audit log.",
  "  - Pass `dryRun: true` on destructive ops to preview what would change.",
  "  - Pass `idempotencyKey` for safe retries.",
  "Call `schema_describe` first if you need to discover capabilities.",
].join("\n");

export function createMcpServer(cfg: KrabsMcpConfig): McpServer {
  const server = new McpServer(
    { name: "krabs", version: "0.0.2" },
    {
      capabilities: { tools: {} },
      instructions: MCP_INSTRUCTIONS,
    },
  );
  registerKrabsTools(server, cfg);
  return server;
}

export function registerKrabsTools(server: McpServer, cfg: KrabsMcpConfig): void {
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

  server.registerTool(
    "contact_import_csv",
    {
      title: "Bulk-import contacts from CSV",
      description:
        "Import contacts from a CSV string. Auto-detects name/email/phone columns or use columnMap. onConflict:'skip' leaves duplicates out, 'link' attaches extra identities to the existing contact. One AgentAction with the list of created ids is emitted — undoing it bulk-deletes the import.",
      inputSchema: {
        csv: z.string().min(1).max(20_000_000),
        columnMap: z
          .object({
            name: z.string().optional(),
            email: z.string().optional(),
            phone: z.string().optional(),
            status: z.string().optional(),
          })
          .optional(),
        defaultStatus: z.enum(contactStatuses).optional(),
        onConflict: z.enum(["skip", "link"]).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { csv: a.csv };
        if (a.columnMap) body.columnMap = a.columnMap;
        if (a.defaultStatus) body.defaultStatus = a.defaultStatus;
        if (a.onConflict) body.onConflict = a.onConflict;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/contacts/import", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_ingest_vcard",
    {
      title: "Ingest vCard",
      description:
        "Ingest a vCard text block. Looks up the contact by any email/phone identity, creates one if missing (toggleable), and attaches any new identities (linkedin, telegram, etc.). Returns the contact + all its identities + which ones were newly added.",
      inputSchema: {
        vcard: z.string().min(1).max(1_000_000),
        createContactIfMissing: z.boolean().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { vcard: a.vcard };
        if (a.createContactIfMissing !== undefined) body.createContactIfMissing = a.createContactIfMissing;
        const opts: Parameters<typeof callApi>[2] = { method: "POST", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/contacts/ingest/vcard", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "account_export",
    {
      title: "Export account as JSON",
      description:
        "Returns a full JSON dump of the account: contacts, identities, interactions, deals, tasks, notes, tags, links, and (optionally) the audit log. Pass since=ISO for an incremental export.",
      inputSchema: {
        since: z.string().datetime().optional(),
        includeActions: z.boolean().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.since) query.since = a.since;
        if (a.includeActions === false) query.include_actions = "0";
        return textResult(await callApi(cfg, "/v1/account/export", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_export_csv",
    {
      title: "Export contacts as CSV",
      description:
        "Returns CSV text with one row per contact (id, name, primary email/phone, status, timestamps, and identities concatenated).",
      inputSchema: {
        status: z.enum(contactStatuses).optional(),
        since: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.status) query.status = a.status;
        if (a.since) query.since = a.since;
        // CSV endpoint returns raw text, not the JSON envelope — bypass apiRequest.
        const url = new URL("/v1/contacts/export.csv", cfg.apiUrl);
        for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
        const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.token}` } });
        if (!res.ok) {
          return errorResult(
            new ApiClientError(res.status, {
              code: res.status === 401 ? "UNAUTHENTICATED" : "INTERNAL",
              message: `Export failed with status ${res.status}`,
            }),
          );
        }
        const csv = await res.text();
        return { content: [{ type: "text" as const, text: csv }] };
      } catch (err) {
        return errorResult(err);
      }
    },
  );

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

  // ── business profile ──────────────────────────────────────
  server.registerTool(
    "business_profile_get",
    {
      title: "Get business profile",
      description:
        "Read the operator's business profile. Returns { profile: null, setAt: null } when the kickoff has not run yet — in that case, ask the human the kickoff questions and call business_profile_set.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/account/business-profile", { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "business_profile_set",
    {
      title: "Set business profile (kickoff)",
      description:
        "Record what kind of business this account runs. Call this once at the start of your first session after asking the human:\n  1) revenue model: recurring_saas (monthly/yearly subscriptions), one_time (memberships or single purchases), hybrid (subs + one-offs), freelance (per project), marketplace, or other\n  2) billing cadence (weekly|monthly|quarterly|yearly|per_project|mixed)\n  3) which paid channels are active (meta_ads, google_ads, tiktok_ads, linkedin_ads, organic, referral, outbound...)\n  4) typical contract size in cents (optional)\n\nThe profile shapes which primitives you default to: recurring_saas → products + subscriptions + invoices; one_time → deals + invoices; freelance → deals + invoices per project. Idempotent — re-call to update.",
      inputSchema: {
        revenueModel: z.enum([
          "recurring_saas",
          "one_time",
          "hybrid",
          "freelance",
          "marketplace",
          "other",
        ]),
        cadence: z
          .enum(["weekly", "monthly", "quarterly", "yearly", "per_project", "mixed"])
          .optional(),
        typicalContractCents: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        activeChannels: z
          .array(
            z.enum([
              "meta_ads",
              "google_ads",
              "tiktok_ads",
              "linkedin_ads",
              "x_ads",
              "youtube_ads",
              "organic",
              "referral",
              "outbound",
              "events",
              "other",
            ]),
          )
          .optional(),
        notes: z.string().max(2000).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { revenueModel: a.revenueModel };
        if (a.cadence) body.cadence = a.cadence;
        if (a.typicalContractCents !== undefined) body.typicalContractCents = a.typicalContractCents;
        if (a.currency) body.currency = a.currency;
        if (a.activeChannels) body.activeChannels = a.activeChannels;
        if (a.notes) body.notes = a.notes;
        const opts: Parameters<typeof callApi>[2] = { method: "PUT", body };
        if (a.intent) opts.intent = a.intent;
        if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
        if (a.dryRun) opts.dryRun = a.dryRun;
        return textResult(await callApi(cfg, "/v1/account/business-profile", opts));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── finance ───────────────────────────────────────────────
  server.registerTool(
    "finance_summary",
    {
      title: "Finance summary",
      description:
        "Revenue (paid + pending), expenses, net, MRR, ARR, active subscriptions, outstanding invoices over a window. Defaults to month-to-date.",
      inputSchema: {
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.from) query.from = a.from;
        if (a.to) query.to = a.to;
        return textResult(await callApi(cfg, "/v1/finance/summary", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finance_mrr",
    {
      title: "MRR / ARR breakdown",
      description: "MRR and ARR broken down by product and billing cycle. Counts trialing / active / paused subs.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/finance/mrr", { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finance_expenses_by_category",
    {
      title: "Expenses by category",
      description: "Expenses bucketed by category over a window. Defaults to month-to-date.",
      inputSchema: {
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.from) query.from = a.from;
        if (a.to) query.to = a.to;
        return textResult(
          await callApi(cfg, "/v1/finance/expenses-by-category", { method: "GET", query }),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── integrations · Stripe ─────────────────────────────────
  server.registerTool(
    "stripe_status",
    {
      title: "Stripe integration status",
      description:
        "Returns { connected: false } until the human wires Stripe via stripe_connect. When connected: displayName, providerAccountId (Stripe acct_*), webhook health, masked secret. Use to decide whether to call subscription/invoice operations directly or wait for the Stripe webhook to mirror data.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/integrations/stripe/status", { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "stripe_connect",
    {
      title: "Connect Stripe (agent-driven)",
      description:
        "Connect the operator's Stripe account by passing a Restricted Key. krabs registers the webhook on Stripe automatically. The human gets the key from https://dashboard.stripe.com/apikeys/create — ask them for it; never invent one. Required permissions: Webhook Endpoints (Write), Customers/Subscriptions/Invoices/Charges/Refunds/Products/Prices (Read). Returns the masked secret so subsequent runs can verify which key is wired.",
      inputSchema: {
        secretKey: z.string().min(10).max(255),
        displayName: z.string().min(1).max(100).optional(),
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { secretKey: a.secretKey };
        body.displayName = a.displayName ?? "Stripe";
        return textResult(await callApi(cfg, "/v1/integrations/stripe", { method: "POST", body }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "stripe_disconnect",
    {
      title: "Disconnect Stripe",
      description:
        "Remove the Stripe integration and the webhook on Stripe's side. The historical sync data (subscriptions, invoices) stays in krabs.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/integrations/stripe", { method: "DELETE" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── integrations · Resend ─────────────────────────────────
  server.registerTool(
    "resend_status",
    {
      title: "Resend integration status",
      description:
        "Returns whether Resend is connected, the masked secret, and how many sending domains exist + how many are verified. Use to decide whether to call email_send or fall back to drafting the email for the human to send manually.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/integrations/resend/status", { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "resend_connect",
    {
      title: "Connect Resend (agent-driven)",
      description:
        "Connect Resend by passing an API key. The human gets it from https://resend.com/api-keys — ask for it; never invent one. Use Full Access so krabs can manage sending domains. Returns the masked secret.",
      inputSchema: {
        secretKey: z.string().min(10).max(255),
        displayName: z.string().min(1).max(100).optional(),
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { secretKey: a.secretKey };
        body.displayName = a.displayName ?? "Resend";
        return textResult(await callApi(cfg, "/v1/integrations/resend", { method: "POST", body }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "resend_disconnect",
    {
      title: "Disconnect Resend",
      description: "Remove the Resend integration. Historical sending-domain rows stay.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/integrations/resend", { method: "DELETE" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "resend_domain_list",
    {
      title: "List sending domains",
      description:
        "List the sending domains krabs has registered with Resend on behalf of this account. Each has status ∈ pending|verified|failed plus its DNS records.",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await callApi(cfg, "/v1/email-domains", { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "resend_domain_add",
    {
      title: "Add a sending domain",
      description:
        "Register a sending domain with Resend. Returns the DNS records the human needs to publish at their registrar (TXT for SPF, CNAME for DKIM, TXT for DMARC). Tell the human exactly which records to add, then call resend_domain_verify after they confirm publication.",
      inputSchema: {
        domain: z.string().min(3).max(253),
        region: z
          .enum(["us-east-1", "eu-west-1", "sa-east-1", "ap-northeast-1"])
          .optional(),
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { domain: a.domain };
        if (a.region) body.region = a.region;
        return textResult(await callApi(cfg, "/v1/email-domains", { method: "POST", body }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "resend_domain_verify",
    {
      title: "Verify a sending domain",
      description:
        "Re-check DNS for a sending domain after the human has published the records. Returns the updated status. DNS propagation can take 1–60 minutes — retry with backoff if status remains pending.",
      inputSchema: { id: z.string().regex(/^edm_[0-9A-HJKMNP-TV-Z]{26}$/) },
    },
    async (a) => {
      try {
        return textResult(
          await callApi(cfg, `/v1/email-domains/${a.id}/verify`, { method: "POST" }),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "resend_domain_remove",
    {
      title: "Remove a sending domain",
      description: "Detach a sending domain from this account and from Resend.",
      inputSchema: { id: z.string().regex(/^edm_[0-9A-HJKMNP-TV-Z]{26}$/) },
    },
    async (a) => {
      try {
        return textResult(
          await callApi(cfg, `/v1/email-domains/${a.id}`, { method: "DELETE" }),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "email_send",
    {
      title: "Send an email via Resend",
      description:
        "Send an email through the connected Resend account. `from` must be on a verified domain (call resend_domain_list to check). Auto-logs an interaction with kind='email_out' and the Resend message id in metadata. Returns 409 if Resend is not connected.",
      inputSchema: {
        from: z.string().min(3).max(254),
        to: z.union([z.string(), z.array(z.string())]),
        subject: z.string().min(1).max(998),
        html: z.string().optional(),
        text: z.string().optional(),
        replyTo: z.string().optional(),
        contactId: z.string().optional(),
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = {
          from: a.from,
          to: a.to,
          subject: a.subject,
        };
        if (a.html) body.html = a.html;
        if (a.text) body.text = a.text;
        if (a.replyTo) body.replyTo = a.replyTo;
        if (a.contactId) body.contactId = a.contactId;
        return textResult(await callApi(cfg, "/v1/email/send", { method: "POST", body }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finance_funnel",
    {
      title: "Funnel metrics (ROAS, CAC)",
      description:
        "Funnel metrics over a window: paid revenue, ad spend with by-source breakdown, new customers, ROAS (revenue ÷ ad spend), CAC (ad spend ÷ new customers), blended-CAC (total expenses ÷ new customers). ROAS is null when ad spend is zero; CAC is null when no contacts converted. To populate this, record ad spend via expense_create with category='ads' and source='meta_ads'|'google_ads'|... — for example after fetching daily spend from Meta's marketing CLI.",
      inputSchema: {
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.from) query.from = a.from;
        if (a.to) query.to = a.to;
        return textResult(await callApi(cfg, "/v1/finance/funnel", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
