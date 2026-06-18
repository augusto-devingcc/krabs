import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  productKinds,
  pricingModels,
  billingCycles,
  productStatuses,
  subscriptionStatuses,
  expenseCategories,
  expenseSources,
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
  "krabs — personal finance tracker (income / expenses / cashflow) for AI agents.",
  "Primitives: products, subscriptions, invoices, expenses, plus finance reporting.",
  "Safety primitives:",
  "  - Pass `intent` to leave a human-readable explanation in the audit log.",
  "  - Pass `dryRun: true` on mutations to preview what would change.",
  "  - Pass `idempotencyKey` for safe retries.",
  "Call `schema_describe` first to discover the full contract.",
].join("\n");

export function createMcpServer(cfg: KrabsMcpConfig): McpServer {
  const server = new McpServer(
    { name: "krabs", version: "0.6.0" },
    {
      capabilities: { tools: {} },
      instructions: MCP_INSTRUCTIONS,
    },
  );
  registerKrabsTools(server, cfg);
  return server;
}

type Opts = Parameters<typeof callApi>[2];

function applyMutationFields(
  opts: Opts,
  a: { intent?: string | undefined; idempotencyKey?: string | undefined; dryRun?: boolean | undefined },
): Opts {
  if (a.intent) opts.intent = a.intent;
  if (a.idempotencyKey) opts.idempotencyKey = a.idempotencyKey;
  if (a.dryRun) opts.dryRun = a.dryRun;
  return opts;
}

const productId = z.string().regex(/^prd_[0-9A-HJKMNP-TV-Z]{26}$/);
const subscriptionId = z.string().regex(/^sub_[0-9A-HJKMNP-TV-Z]{26}$/);
const invoiceId = z.string().regex(/^inv_[0-9A-HJKMNP-TV-Z]{26}$/);
const expenseId = z.string().regex(/^exp_[0-9A-HJKMNP-TV-Z]{26}$/);
const actionId = z.string().regex(/^act_[0-9A-HJKMNP-TV-Z]{26}$/);
const apiKeyIdRegex = z.string().regex(/^key_[0-9A-HJKMNP-TV-Z]{26}$/);

export function registerKrabsTools(server: McpServer, cfg: KrabsMcpConfig): void {
  // ── contract ──────────────────────────────────────────────
  server.registerTool(
    "schema_describe",
    {
      title: "Describe the contract",
      description:
        "Returns the full agent-facing contract: every operation, its input schema, and metadata (destructive? idempotent? supports dry-run?).",
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await apiRequest<unknown>(cfg, "/v1/schema"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── account ───────────────────────────────────────────────
  server.registerTool(
    "account_get",
    { title: "Get account", description: "Return the current account.", inputSchema: {} },
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
        return textResult(await callApi(cfg, "/v1/account", applyMutationFields({ method: "PATCH", body: patch }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── api keys ──────────────────────────────────────────────
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
      description: "Issue a new API key. The plaintext token is returned once; save it.",
      inputSchema: {
        label: z.string().min(1).max(100),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, "/v1/api-keys", applyMutationFields({ method: "POST", body: { label: a.label } }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "api_key_revoke",
    {
      title: "Revoke API key (destructive)",
      description: "Immediately revoke an API key.",
      inputSchema: {
        id: apiKeyIdRegex,
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/api-keys/${a.id}`, applyMutationFields({ method: "DELETE" }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── products ──────────────────────────────────────────────
  server.registerTool(
    "product_create",
    {
      title: "Create product",
      description: "Create a product/plan. unitAmountCents is integer cents.",
      inputSchema: {
        name: z.string().min(1).max(200),
        kind: z.enum(productKinds).optional(),
        pricingModel: z.enum(pricingModels).optional(),
        unitAmountCents: z.number().int().min(0),
        currency: z.string().length(3).optional(),
        billingCycle: z.enum(billingCycles).optional(),
        customCycleDays: z.number().int().positive().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { name: a.name, unitAmountCents: a.unitAmountCents };
        for (const f of ["kind", "pricingModel", "currency", "billingCycle", "customCycleDays"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) body[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, "/v1/products", applyMutationFields({ method: "POST", body }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "product_get",
    { title: "Get product", description: "Fetch a product by id.", inputSchema: { id: productId } },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/products/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "product_list",
    {
      title: "List products",
      description: "List products with filters.",
      inputSchema: { status: z.enum(productStatuses).optional(), kind: z.enum(productKinds).optional() },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.status) query.status = a.status;
        if (a.kind) query.kind = a.kind;
        return textResult(await callApi(cfg, "/v1/products", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "product_update",
    {
      title: "Update product",
      description: "Partially update a product.",
      inputSchema: {
        id: productId,
        name: z.string().min(1).max(200).optional(),
        kind: z.enum(productKinds).optional(),
        pricingModel: z.enum(pricingModels).optional(),
        unitAmountCents: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        billingCycle: z.enum(billingCycles).nullable().optional(),
        customCycleDays: z.number().int().positive().nullable().optional(),
        status: z.enum(productStatuses).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        for (const f of ["name", "kind", "pricingModel", "unitAmountCents", "currency", "billingCycle", "customCycleDays", "status"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) patch[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, `/v1/products/${a.id}`, applyMutationFields({ method: "PATCH", body: patch }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── subscriptions ─────────────────────────────────────────
  server.registerTool(
    "subscription_create",
    {
      title: "Create subscription",
      description: "Create a recurring subscription. counterparty is a free-text payer name.",
      inputSchema: {
        counterparty: z.string().max(255).optional(),
        productId: productId.optional(),
        amountCents: z.number().int().min(0),
        currency: z.string().length(3).optional(),
        billingCycle: z.enum(billingCycles),
        customCycleDays: z.number().int().positive().optional(),
        status: z.enum(subscriptionStatuses).optional(),
        startedAt: z.string().datetime().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { amountCents: a.amountCents, billingCycle: a.billingCycle };
        for (const f of ["counterparty", "productId", "currency", "customCycleDays", "status", "startedAt"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) body[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, "/v1/subscriptions", applyMutationFields({ method: "POST", body }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "subscription_get",
    { title: "Get subscription", description: "Fetch a subscription by id.", inputSchema: { id: subscriptionId } },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/subscriptions/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "subscription_list",
    {
      title: "List subscriptions",
      description: "List subscriptions with filters.",
      inputSchema: { status: z.enum(subscriptionStatuses).optional(), productId: productId.optional() },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.status) query.status = a.status;
        if (a.productId) query.product_id = a.productId;
        return textResult(await callApi(cfg, "/v1/subscriptions", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "subscription_update",
    {
      title: "Update subscription",
      description: "Partially update a subscription (recomputes MRR when amount/cycle change).",
      inputSchema: {
        id: subscriptionId,
        counterparty: z.string().max(255).nullable().optional(),
        productId: productId.nullable().optional(),
        amountCents: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        billingCycle: z.enum(billingCycles).optional(),
        customCycleDays: z.number().int().positive().nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        for (const f of ["counterparty", "productId", "amountCents", "currency", "billingCycle", "customCycleDays"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) patch[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, `/v1/subscriptions/${a.id}`, applyMutationFields({ method: "PATCH", body: patch }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "subscription_cancel",
    {
      title: "Cancel subscription",
      description: "Cancel now or schedule a future cancel (cancelAt).",
      inputSchema: {
        id: subscriptionId,
        reason: z.string().max(500).optional(),
        cancelAt: z.string().datetime().nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = {};
        if (a.reason !== undefined) body.reason = a.reason;
        if (a.cancelAt !== undefined) body.cancelAt = a.cancelAt;
        return textResult(await callApi(cfg, `/v1/subscriptions/${a.id}/cancel`, applyMutationFields({ method: "POST", body }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  for (const verb of ["pause", "resume"] as const) {
    server.registerTool(
      `subscription_${verb}`,
      {
        title: `${verb[0]!.toUpperCase()}${verb.slice(1)} subscription`,
        description: `${verb === "pause" ? "Pause an active" : "Resume a paused"} subscription.`,
        inputSchema: {
          id: subscriptionId,
          intent: intentField,
          idempotencyKey: idemField,
          dryRun: dryRunField,
        },
      },
      async (a) => {
        try {
          return textResult(await callApi(cfg, `/v1/subscriptions/${a.id}/${verb}`, applyMutationFields({ method: "POST", body: {} }, a)));
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  }

  // ── invoices ──────────────────────────────────────────────
  server.registerTool(
    "invoice_create",
    {
      title: "Create invoice",
      description: "Create a draft invoice. counterparty is a free-text payer name. Number auto-assigned.",
      inputSchema: {
        counterparty: z.string().max(255).optional(),
        subscriptionId: subscriptionId.optional(),
        amountCents: z.number().int().min(0),
        currency: z.string().length(3).optional(),
        issuedAt: z.string().datetime().optional(),
        dueAt: z.string().datetime().optional(),
        note: z.string().max(2000).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { amountCents: a.amountCents };
        for (const f of ["counterparty", "subscriptionId", "currency", "issuedAt", "dueAt", "note"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) body[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, "/v1/invoices", applyMutationFields({ method: "POST", body }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "invoice_get",
    { title: "Get invoice", description: "Fetch an invoice by id.", inputSchema: { id: invoiceId } },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/invoices/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "invoice_list",
    {
      title: "List invoices",
      description: "List invoices with filters.",
      inputSchema: {
        status: z.enum(["draft", "sent", "paid", "overdue", "void", "refunded"]).optional(),
        subscriptionId: subscriptionId.optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.status) query.status = a.status;
        if (a.subscriptionId) query.subscription_id = a.subscriptionId;
        if (a.from) query.from = a.from;
        if (a.to) query.to = a.to;
        return textResult(await callApi(cfg, "/v1/invoices", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "invoice_update",
    {
      title: "Update invoice",
      description: "Partially update a non-terminal invoice.",
      inputSchema: {
        id: invoiceId,
        counterparty: z.string().max(255).nullable().optional(),
        amountCents: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        issuedAt: z.string().datetime().optional(),
        dueAt: z.string().datetime().nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        for (const f of ["counterparty", "amountCents", "currency", "issuedAt", "dueAt", "note"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) patch[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, `/v1/invoices/${a.id}`, applyMutationFields({ method: "PATCH", body: patch }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "invoice_send",
    {
      title: "Send invoice",
      description: "Transition a draft invoice to 'sent'.",
      inputSchema: { id: invoiceId, intent: intentField, idempotencyKey: idemField, dryRun: dryRunField },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/invoices/${a.id}/send`, applyMutationFields({ method: "POST", body: {} }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "invoice_pay",
    {
      title: "Mark invoice paid",
      description: "Mark a sent/overdue invoice as paid.",
      inputSchema: {
        id: invoiceId,
        paidAt: z.string().datetime().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = {};
        if (a.paidAt) body.paidAt = a.paidAt;
        return textResult(await callApi(cfg, `/v1/invoices/${a.id}/pay`, applyMutationFields({ method: "POST", body }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "invoice_void",
    {
      title: "Void invoice (destructive)",
      description: "Void a non-paid invoice.",
      inputSchema: { id: invoiceId, intent: intentField, idempotencyKey: idemField, dryRun: dryRunField },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/invoices/${a.id}/void`, applyMutationFields({ method: "POST", body: {} }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── expenses ──────────────────────────────────────────────
  server.registerTool(
    "expense_create",
    {
      title: "Create expense",
      description:
        "Record an expense (integer cents). Set category='ads' and source='meta_ads'|'google_ads'|... so finance_funnel ROAS lights up.",
      inputSchema: {
        amountCents: z.number().int().min(0),
        currency: z.string().length(3).optional(),
        category: z.enum(expenseCategories),
        vendor: z.string().max(255).optional(),
        description: z.string().max(2000).optional(),
        occurredAt: z.string().datetime().optional(),
        source: z.enum(expenseSources).optional(),
        sourceRef: z.string().max(255).optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const body: Record<string, unknown> = { amountCents: a.amountCents, category: a.category };
        for (const f of ["currency", "vendor", "description", "occurredAt", "source", "sourceRef"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) body[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, "/v1/expenses", applyMutationFields({ method: "POST", body }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "expense_get",
    { title: "Get expense", description: "Fetch an expense by id.", inputSchema: { id: expenseId } },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/expenses/${a.id}`, { method: "GET" }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "expense_list",
    {
      title: "List expenses",
      description: "List expenses with filters.",
      inputSchema: {
        category: z.enum(expenseCategories).optional(),
        source: z.enum(expenseSources).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.category) query.category = a.category;
        if (a.source) query.source = a.source;
        if (a.from) query.from = a.from;
        if (a.to) query.to = a.to;
        return textResult(await callApi(cfg, "/v1/expenses", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "expense_update",
    {
      title: "Update expense",
      description: "Partially update an expense.",
      inputSchema: {
        id: expenseId,
        amountCents: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        category: z.enum(expenseCategories).optional(),
        vendor: z.string().max(255).nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        occurredAt: z.string().datetime().optional(),
        intent: intentField,
        idempotencyKey: idemField,
        dryRun: dryRunField,
      },
    },
    async (a) => {
      try {
        const patch: Record<string, unknown> = {};
        for (const f of ["amountCents", "currency", "category", "vendor", "description", "occurredAt"] as const) {
          if ((a as Record<string, unknown>)[f] !== undefined) patch[f] = (a as Record<string, unknown>)[f];
        }
        return textResult(await callApi(cfg, `/v1/expenses/${a.id}`, applyMutationFields({ method: "PATCH", body: patch }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "expense_delete",
    {
      title: "Delete expense (destructive)",
      description: "Hard-delete an expense.",
      inputSchema: { id: expenseId, intent: intentField, idempotencyKey: idemField, dryRun: dryRunField },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/expenses/${a.id}`, applyMutationFields({ method: "DELETE" }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── finance reporting ─────────────────────────────────────
  server.registerTool(
    "finance_summary",
    {
      title: "Finance summary",
      description:
        "Revenue (paid + pending), expenses, net, MRR, ARR, active subscriptions, outstanding invoices over a window. Defaults to month-to-date.",
      inputSchema: { from: z.string().datetime().optional(), to: z.string().datetime().optional() },
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
      inputSchema: { from: z.string().datetime().optional(), to: z.string().datetime().optional() },
    },
    async (a) => {
      try {
        const query: Record<string, string> = {};
        if (a.from) query.from = a.from;
        if (a.to) query.to = a.to;
        return textResult(await callApi(cfg, "/v1/finance/expenses-by-category", { method: "GET", query }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "finance_funnel",
    {
      title: "Funnel metrics (ROAS)",
      description:
        "Funnel metrics over a window: paid revenue, ad spend with by-source breakdown, ROAS (revenue ÷ ad spend). ROAS is null when ad spend is zero. Record ad spend via expense_create category='ads' source='meta_ads'|'google_ads'|....",
      inputSchema: { from: z.string().datetime().optional(), to: z.string().datetime().optional() },
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

  // ── audit ─────────────────────────────────────────────────
  server.registerTool(
    "action_get",
    {
      title: "Get audit action",
      description: "Fetch a single action by id, including its full metadata.",
      inputSchema: { id: actionId },
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
    "action_list",
    {
      title: "List agent actions",
      description: "Inspect what agents (including you) have done. Use to audit recent activity.",
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

  server.registerTool(
    "action_undo",
    {
      title: "Undo a previous action",
      description:
        "Reverse a previously-recorded reversible mutation (account.update, api_key.create/revoke) using the snapshot in its metadata. Returns CONFLICT for one-way operations. Supports dryRun.",
      inputSchema: { id: actionId, intent: intentField, idempotencyKey: idemField, dryRun: dryRunField },
    },
    async (a) => {
      try {
        return textResult(await callApi(cfg, `/v1/actions/${a.id}/undo`, applyMutationFields({ method: "POST", body: {} }, a)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
