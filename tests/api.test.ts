import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "socrm-test-"));
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

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  const accountId = newId("account");
  const apiKeyId = newId("apiKey");
  token = generateApiKeyPlaintext();

  await db.insert(accounts).values({ id: accountId, email: "test@socrm.local", name: "Test" });
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

describe("GET /v1/health", () => {
  it("returns ok envelope without auth", async () => {
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      data: { ok: true, service: "krabs-api" },
      _schema_version: "1",
    });
  });
});

describe("GET /v1/me", () => {
  it("rejects missing auth header", async () => {
    const res = await app.request("/v1/me");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects invalid api key format", async () => {
    const res = await app.request("/v1/me", {
      headers: { Authorization: "Bearer not_a_real_key" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_API_KEY");
  });

  it("rejects unknown api key", async () => {
    const res = await app.request("/v1/me", {
      headers: { Authorization: `Bearer ${generateApiKeyPlaintext()}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_API_KEY");
  });

  it("returns account for a valid api key", async () => {
    const res = await app.request("/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { account: { email: string }; apiKeyId: string };
      _schema_version: string;
    };
    expect(body._schema_version).toBe("1");
    expect(body.data.account.email).toBe("test@socrm.local");
    expect(body.data.apiKeyId).toMatch(/^key_/);
  });
});

describe("404 handler", () => {
  it("returns structured error for unknown route", async () => {
    const res = await app.request("/v1/does-not-exist");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
