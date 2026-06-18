import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { accountUpdateInputSchema } from "../domain/account.js";
import { apiKeyCreateInputSchema } from "../domain/api-key.js";
import {
  productCreateInputSchema,
  productUpdateInputSchema,
  productListFiltersSchema,
} from "../domain/product.js";
import {
  subscriptionCreateInputSchema,
  subscriptionUpdateInputSchema,
  subscriptionListFiltersSchema,
  cancelSubscriptionInputSchema,
} from "../domain/subscription.js";
import {
  invoiceCreateInputSchema,
  invoiceUpdateInputSchema,
  invoiceListFiltersSchema,
  markInvoicePaidInputSchema,
} from "../domain/invoice.js";
import {
  expenseCreateInputSchema,
  expenseUpdateInputSchema,
  expenseListFiltersSchema,
} from "../domain/expense.js";
import { reversibilityOf, type Reversibility } from "../domain/action.js";
import { idSchema } from "./ids.js";

/**
 * The operation catalog is the agent-facing source of truth.
 * `schema.describe` returns this verbatim so an agent can bootstrap
 * itself with zero docs.
 */

export type OperationDescriptor = {
  operation: string;
  description: string;
  inputSchema: ReturnType<typeof zodToJsonSchema>;
  destructive: boolean;
  idempotent: boolean;
  supportsDryRun: boolean;
  supportsIntent: boolean;
  reversibility: Reversibility;
};

function withReversibility(ops: Omit<OperationDescriptor, "reversibility">[]): OperationDescriptor[] {
  return ops.map((o) => ({ ...o, reversibility: reversibilityOf(o.operation) }));
}

const apiKeyIdInput = z.object({ id: idSchema("apiKey") });
const rangeInput = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export function buildOperationCatalog(): OperationDescriptor[] {
  return withReversibility([
    {
      operation: "account.update",
      description: "Update the current account's name or email.",
      inputSchema: zodToJsonSchema(accountUpdateInputSchema, { name: "AccountUpdateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "api_key.create",
      description: "Issue a new API key. Plaintext token is returned exactly once.",
      inputSchema: zodToJsonSchema(apiKeyCreateInputSchema, { name: "ApiKeyCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "api_key.list",
      description: "List API keys for the current account.",
      inputSchema: zodToJsonSchema(
        z.object({ includeRevoked: z.boolean().optional() }),
        { name: "ApiKeyListInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "api_key.revoke",
      description: "Revoke an API key. The owning agent loses access on next request.",
      inputSchema: zodToJsonSchema(apiKeyIdInput, { name: "ApiKeyRevokeInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "action.list",
      description: "Read the agent audit log: who did what, when, with what intent.",
      inputSchema: zodToJsonSchema(
        z.object({
          limit: z.number().int().min(1).max(200).optional(),
          apiKeyId: z.string().optional(),
          targetKind: z.string().optional(),
          targetId: z.string().optional(),
        }),
        { name: "ActionListInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "action.get",
      description: "Fetch a single audit action by id, including its full metadata (snapshots).",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("agentAction") }), { name: "ActionGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "action.undo",
      description:
        "Reverse a previously-recorded action using the snapshot stored in its metadata. Works on operations marked reversibility:'reversible'. Returns CONFLICT for one-way operations.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("agentAction") }), { name: "ActionUndoInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── products ────────────────────────────────────────────
    {
      operation: "product.create",
      description: "Create a product/plan (saas, service, retainer, product). Money in integer cents.",
      inputSchema: zodToJsonSchema(productCreateInputSchema, { name: "ProductCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "product.get",
      description: "Fetch a product by id.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("product") }), { name: "ProductGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "product.list",
      description: "List products with filters (status, kind).",
      inputSchema: zodToJsonSchema(productListFiltersSchema, { name: "ProductListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "product.update",
      description: "Partially update a product.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("product"), patch: productUpdateInputSchema }),
        { name: "ProductUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── subscriptions ───────────────────────────────────────
    {
      operation: "subscription.create",
      description:
        "Create a recurring subscription. counterparty is a free-text payer name. MRR is computed and denormalized.",
      inputSchema: zodToJsonSchema(subscriptionCreateInputSchema, { name: "SubscriptionCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "subscription.get",
      description: "Fetch a subscription by id.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("subscription") }), { name: "SubscriptionGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "subscription.list",
      description: "List subscriptions with filters (status, productId).",
      inputSchema: zodToJsonSchema(subscriptionListFiltersSchema, { name: "SubscriptionListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "subscription.update",
      description: "Partially update a subscription (recomputes MRR when amount/cycle change).",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("subscription"), patch: subscriptionUpdateInputSchema }),
        { name: "SubscriptionUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "subscription.cancel",
      description: "Cancel a subscription now or schedule a future cancel (cancelAt).",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("subscription"), patch: cancelSubscriptionInputSchema }),
        { name: "SubscriptionCancelInput" },
      ),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "subscription.pause",
      description: "Pause an active subscription.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("subscription") }), { name: "SubscriptionPauseInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "subscription.resume",
      description: "Resume a paused subscription.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("subscription") }), { name: "SubscriptionResumeInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── invoices ────────────────────────────────────────────
    {
      operation: "invoice.create",
      description:
        "Create a draft invoice. counterparty is a free-text payer name. Number auto-assigned (INV-YYYY-NNNN).",
      inputSchema: zodToJsonSchema(invoiceCreateInputSchema, { name: "InvoiceCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "invoice.get",
      description: "Fetch an invoice by id.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("invoice") }), { name: "InvoiceGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "invoice.list",
      description: "List invoices with filters (status, subscriptionId, from, to).",
      inputSchema: zodToJsonSchema(invoiceListFiltersSchema, { name: "InvoiceListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "invoice.update",
      description: "Partially update a non-terminal invoice.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("invoice"), patch: invoiceUpdateInputSchema }),
        { name: "InvoiceUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "invoice.send",
      description: "Transition a draft invoice to 'sent'.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("invoice") }), { name: "InvoiceSendInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "invoice.pay",
      description: "Mark a sent/overdue invoice as paid.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("invoice"), patch: markInvoicePaidInputSchema }),
        { name: "InvoicePayInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "invoice.void",
      description: "Void a non-paid invoice.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("invoice") }), { name: "InvoiceVoidInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── expenses ────────────────────────────────────────────
    {
      operation: "expense.create",
      description:
        "Record an expense (integer cents). Set category='ads' and source='meta_ads'|'google_ads'|... so finance.funnel ROAS lights up.",
      inputSchema: zodToJsonSchema(expenseCreateInputSchema, { name: "ExpenseCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "expense.get",
      description: "Fetch an expense by id.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("expense") }), { name: "ExpenseGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "expense.list",
      description: "List expenses with filters (category, source, from, to).",
      inputSchema: zodToJsonSchema(expenseListFiltersSchema, { name: "ExpenseListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "expense.update",
      description: "Partially update an expense.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("expense"), patch: expenseUpdateInputSchema }),
        { name: "ExpenseUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "expense.delete",
      description: "Hard-delete an expense.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("expense") }), { name: "ExpenseDeleteInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── finance reporting ───────────────────────────────────
    {
      operation: "finance.summary",
      description:
        "Revenue (paid + pending), expenses, net, MRR, ARR, active subscriptions, outstanding invoices over a window. Defaults to month-to-date if range omitted.",
      inputSchema: zodToJsonSchema(rangeInput, { name: "FinanceSummaryInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "finance.mrr",
      description:
        "MRR / ARR breakdown by product and billing cycle. Includes counts for trialing / active / paused subscriptions.",
      inputSchema: zodToJsonSchema(z.object({}).strict(), { name: "FinanceMrrInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "finance.expenses_by_category",
      description: "Expenses bucketed by category over a window. Defaults to month-to-date.",
      inputSchema: zodToJsonSchema(rangeInput, { name: "FinanceExpensesByCategoryInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "finance.funnel",
      description:
        "Funnel metrics over a window: paid revenue, ad spend (with by-source breakdown), ROAS (revenue ÷ ad spend). ROAS is null when ad spend is zero. Record ad spend with `expense.create category='ads' source='meta_ads'|'google_ads'|...`.",
      inputSchema: zodToJsonSchema(rangeInput, { name: "FinanceFunnelInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
  ]);
}

export function describeContract() {
  return {
    schemaVersion: "1",
    contract: {
      authentication: "Bearer API key (Authorization: Bearer krabs_sk_...)",
      envelope: { successKey: "data", errorKey: "error" },
      idempotencyHeader: "Idempotency-Key",
      intentHeader: "X-Agent-Intent",
      dryRunQueryParam: "dry_run",
      errorCodes: [
        "VALIDATION_FAILED",
        "IDEMPOTENCY_CONFLICT",
        "UNAUTHENTICATED",
        "INVALID_API_KEY",
        "NOT_FOUND",
        "CONFLICT",
        "RATE_LIMITED",
        "INTERNAL",
      ],
    },
    operations: buildOperationCatalog(),
    reversibilityValues: ["reversible", "one-way", "read-only"],
  };
}
