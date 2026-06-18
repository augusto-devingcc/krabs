import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "krabs-finance-test-"));
const dbPath = join(tmp, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db, libsql } = await import("@/db/client.js");
const { accounts, apiKeys } = await import("@/db/schema.js");
const { buildApp } = await import("@/api/app.js");
const { newId } = await import("@/contract/ids.js");
const { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } = await import("@/lib/hash.js");

const app = buildApp();
let token: string;

function authHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
}

async function post(path: string, body: unknown, extra: Record<string, string> = {}) {
  return app.request(path, { method: "POST", headers: authHeaders(extra), body: JSON.stringify(body) });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  const accountId = newId("account");
  const apiKeyId = newId("apiKey");
  token = generateApiKeyPlaintext();
  await db.insert(accounts).values({ id: accountId, email: "test@krabs.local", name: "Test" });
  await db.insert(apiKeys).values({
    id: apiKeyId,
    accountId,
    label: "test",
    tokenHash: sha256Hex(token),
    tokenPreview: apiKeyPreview(token),
  });
});

afterAll(() => {
  libsql.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("schema.describe", () => {
  it("lists only finance + account + api-key + action operations", async () => {
    const res = await app.request("/v1/schema");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { operations: Array<{ operation: string }> } };
    const ops = body.data.operations.map((o) => o.operation);
    expect(ops).toContain("invoice.create");
    expect(ops).toContain("expense.create");
    expect(ops).toContain("subscription.create");
    expect(ops).toContain("finance.summary");
    // CRM operations must be gone
    expect(ops).not.toContain("contact.create");
    expect(ops).not.toContain("deal.create");
    expect(ops.some((o) => o.startsWith("integration."))).toBe(false);
  });
});

describe("products + subscriptions + MRR", () => {
  let productId: string;

  it("creates a recurring product", async () => {
    const res = await post("/v1/products", {
      name: "Pro plan",
      pricingModel: "recurring",
      billingCycle: "monthly",
      unitAmountCents: 5000,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { product: { id: string } } };
    productId = body.data.product.id;
    expect(productId).toMatch(/^prd_/);
  });

  it("creates a subscription without a contact (counterparty only)", async () => {
    const res = await post("/v1/subscriptions", {
      counterparty: "Acme LLC",
      productId,
      amountCents: 5000,
      billingCycle: "monthly",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { subscription: { mrrCents: number; counterparty: string } } };
    expect(body.data.subscription.mrrCents).toBe(5000);
    expect(body.data.subscription.counterparty).toBe("Acme LLC");
  });

  it("reports MRR in the finance summary", async () => {
    const res = await app.request("/v1/finance/mrr", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { mrr_cents: number; arr_cents: number } };
    expect(body.data.mrr_cents).toBe(5000);
    expect(body.data.arr_cents).toBe(60000);
  });
});

describe("invoices income flow", () => {
  it("creates, sends and pays an invoice, reflected in the summary", async () => {
    const create = await post("/v1/invoices", { counterparty: "Acme LLC", amountCents: 12000 });
    expect(create.status).toBe(201);
    const { data } = (await create.json()) as { data: { invoice: { id: string; number: string } } };
    expect(data.invoice.number).toMatch(/^INV-\d{4}-\d{4}$/);

    const send = await post(`/v1/invoices/${data.invoice.id}/send`, {});
    expect(send.status).toBe(200);

    const pay = await post(`/v1/invoices/${data.invoice.id}/pay`, {});
    expect(pay.status).toBe(200);

    const summary = await app.request("/v1/finance/summary", { headers: authHeaders() });
    const body = (await summary.json()) as { data: { revenue: { paid_cents: number } } };
    expect(body.data.revenue.paid_cents).toBe(12000);
  });
});

describe("expenses + cashflow + ROAS", () => {
  it("records an ad expense and computes net + ROAS", async () => {
    const res = await post("/v1/expenses", {
      amountCents: 3000,
      category: "ads",
      source: "meta_ads",
    });
    expect(res.status).toBe(201);

    const summary = await app.request("/v1/finance/summary", { headers: authHeaders() });
    const sBody = (await summary.json()) as { data: { expenses: { total_cents: number }; net_cents: number } };
    expect(sBody.data.expenses.total_cents).toBe(3000);
    expect(sBody.data.net_cents).toBe(12000 - 3000);

    const funnel = await app.request("/v1/finance/funnel", { headers: authHeaders() });
    const fBody = (await funnel.json()) as { data: { roas: number | null; ad_spend: { total_cents: number } } };
    expect(fBody.data.ad_spend.total_cents).toBe(3000);
    expect(fBody.data.roas).toBeCloseTo(12000 / 3000);
  });

  it("buckets expenses by category", async () => {
    const res = await app.request("/v1/finance/expenses-by-category", { headers: authHeaders() });
    const body = (await res.json()) as { data: { by_category: Array<{ category: string; total_cents: number }> } };
    expect(body.data.by_category.find((c) => c.category === "ads")?.total_cents).toBe(3000);
  });
});

describe("audit log", () => {
  it("records an agent action per mutation and exposes it", async () => {
    const res = await app.request("/v1/actions", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: Array<{ operation: string }> } };
    const ops = body.data.items.map((i) => i.operation);
    expect(ops).toContain("invoice.create");
    expect(ops).toContain("expense.create");
    expect(ops).toContain("subscription.create");
  });
});
