import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "krabs-stripe-test-"));
const dbPath = join(tmp, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;
// Skip Stripe signature verification in tests
process.env.KRABS_STRIPE_SKIP_SIG = "true";
// A non-empty webhook secret so the route doesn't 503
process.env.KRABS_STRIPE_WEBHOOK_SECRET = "whsec_test";

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db, libsql } = await import("@/db/client.js");
const { accounts, apiKeys } = await import("@/db/schema.js");
const { buildApp } = await import("@/api/app.js");
const { newId } = await import("@/contract/ids.js");
const { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } = await import("@/lib/hash.js");

const app = buildApp();
let token: string;
let accountId: string;

function authHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  accountId = newId("account");
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

function makeInvoicePaidEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_test_01",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_stripe_test_01",
        object: "invoice",
        amount_paid: 4900,
        currency: "usd",
        description: "Monthly Pro plan",
        customer_name: "Acme Corp",
        customer_email: "billing@acme.com",
        status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
        metadata: {},
        ...overrides,
      },
    },
  };
}

describe("Stripe webhook — invoice.paid", () => {
  it("returns 200 and creates an invoice", async () => {
    const payload = makeInvoicePaidEvent();

    const res = await app.request("/v1/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // Verify invoice was created
    const listRes = await app.request("/v1/invoices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: { items: Array<{ amountCents: number; counterparty: string | null; note: string | null }> } };
    const items = listBody.data.items;
    expect(items.length).toBeGreaterThan(0);
    const created = items.find((i) => i.amountCents === 4900 && i.counterparty === "Acme Corp");
    expect(created).toBeDefined();
    expect(created?.note).toBe("Monthly Pro plan");
  });

  it("returns 503 when webhook secret is not configured", async () => {
    const saved = process.env.KRABS_STRIPE_WEBHOOK_SECRET;
    delete process.env.KRABS_STRIPE_WEBHOOK_SECRET;

    const res = await app.request("/v1/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeInvoicePaidEvent()),
    });

    expect(res.status).toBe(503);
    process.env.KRABS_STRIPE_WEBHOOK_SECRET = saved;
  });
});
