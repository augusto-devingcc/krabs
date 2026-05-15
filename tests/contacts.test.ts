import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "socrm-contacts-test-"));
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
let auth: { Authorization: string };

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  const accountId = newId("account");
  const apiKeyId = newId("apiKey");
  token = generateApiKeyPlaintext();

  await db.insert(accounts).values({ id: accountId, email: "owner@example.com", name: "Owner" });
  await db.insert(apiKeys).values({
    id: apiKeyId,
    accountId,
    label: "test",
    tokenHash: sha256Hex(token),
    tokenPreview: apiKeyPreview(token),
  });

  auth = { Authorization: `Bearer ${token}` };
});

afterAll(() => {
  libsql.close();
  rmSync(tmp, { recursive: true, force: true });
});

type CreateResp = {
  data: {
    contact: { id: string; name: string; primaryEmail: string | null; status: string };
    identities: { id: string; kind: string; value: string }[];
    agentActionId: string | null;
    dryRun: boolean;
    replayed: boolean;
  };
  _schema_version: string;
};

async function createContact(
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
  query = "",
): Promise<{ status: number; body: CreateResp | { error: { code: string } } }> {
  const res = await app.request(`/v1/contacts${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth, ...extraHeaders },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as CreateResp };
}

describe("POST /v1/contacts", () => {
  it("creates a contact with an email identity and an agent action", async () => {
    const { status, body } = await createContact(
      { name: "Ada Lovelace", email: "ada@example.com" },
      { "X-Agent-Intent": "test" },
    );
    expect(status).toBe(201);
    expect("data" in body).toBe(true);
    if (!("data" in body)) return;
    expect(body.data.contact.name).toBe("Ada Lovelace");
    expect(body.data.contact.primaryEmail).toBe("ada@example.com");
    expect(body.data.contact.id).toMatch(/^cnt_/);
    expect(body.data.identities.length).toBe(1);
    expect(body.data.identities[0]!.kind).toBe("email");
    expect(body.data.identities[0]!.value).toBe("ada@example.com");
    expect(body.data.agentActionId).toMatch(/^act_/);
    expect(body.data.dryRun).toBe(false);
    expect(body.data.replayed).toBe(false);
  });

  it("rejects empty name with field-level validation error", async () => {
    const { status, body } = await createContact({ name: "", email: "x@y.com" });
    expect(status).toBe(400);
    if (!("error" in body)) throw new Error("expected error");
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns the same response on idempotency-key replay without creating a duplicate", async () => {
    const first = await createContact(
      { name: "Grace Hopper", email: "grace@example.com" },
      { "Idempotency-Key": "idem-1" },
    );
    expect(first.status).toBe(201);
    if (!("data" in first.body)) throw new Error("expected data");
    expect(first.body.data.replayed).toBe(false);
    const firstId = first.body.data.contact.id;

    const replay = await createContact(
      { name: "Different Name", email: "different@example.com" },
      { "Idempotency-Key": "idem-1" },
    );
    expect(replay.status).toBe(200);
    if (!("data" in replay.body)) throw new Error("expected data");
    expect(replay.body.data.replayed).toBe(true);
    expect(replay.body.data.contact.id).toBe(firstId);
    expect(replay.body.data.contact.name).toBe("Grace Hopper");
  });

  it("dry-run returns a contact shape without persisting", async () => {
    const { status, body } = await createContact(
      { name: "Margaret H", email: "margaret@example.com" },
      {},
      "?dry_run=1",
    );
    expect(status).toBe(201);
    if (!("data" in body)) throw new Error("expected data");
    expect(body.data.dryRun).toBe(true);
    expect(body.data.agentActionId).toBeNull();
    expect(body.data.contact.id).toMatch(/^cnt_/);

    // GET should fail with NOT_FOUND
    const get = await app.request(`/v1/contacts/${body.data.contact.id}`, { headers: auth });
    expect(get.status).toBe(404);
  });

  it("rejects duplicate email identity across contacts in the same account", async () => {
    const a = await createContact({ name: "A", email: "dup@example.com" });
    expect(a.status).toBe(201);
    const b = await createContact({ name: "B", email: "dup@example.com" });
    expect(b.status).toBe(409);
    if (!("error" in b.body)) throw new Error("expected error");
    expect(b.body.error.code).toBe("CONFLICT");
  });
});

describe("GET /v1/contacts/:id", () => {
  it("returns the contact and its identities", async () => {
    const created = await createContact({ name: "Linus T", email: "linus@example.com" });
    if (!("data" in created.body)) throw new Error("expected data");
    const id = created.body.data.contact.id;

    const res = await app.request(`/v1/contacts/${id}`, { headers: auth });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { contact: { id: string }; identities: { kind: string }[] };
    };
    expect(body.data.contact.id).toBe(id);
    expect(body.data.identities.some((i) => i.kind === "email")).toBe(true);
  });

  it("returns 404 for unknown contact", async () => {
    const res = await app.request("/v1/contacts/cnt_01ABCDEFGHJKMNPQRSTVWXYZ12", { headers: auth });
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed contact id", async () => {
    const res = await app.request("/v1/contacts/not-a-real-id", { headers: auth });
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/actions", () => {
  it("lists actions recorded by the current account", async () => {
    await createContact({ name: "Hedy Lamarr", email: "hedy@example.com" }, { "X-Agent-Intent": "track" });

    const res = await app.request("/v1/actions?limit=10", { headers: auth });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { items: { operation: string; intent: string | null }[] };
    };
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(body.data.items.some((a) => a.operation === "contact.create")).toBe(true);
    expect(body.data.items.some((a) => a.intent === "track")).toBe(true);
  });

  it("filters by target_id", async () => {
    const created = await createContact({ name: "Filter Target", email: "filter@example.com" });
    if (!("data" in created.body)) throw new Error("expected data");
    const targetId = created.body.data.contact.id;

    const res = await app.request(`/v1/actions?target_id=${targetId}`, { headers: auth });
    const body = (await res.json()) as { data: { items: { targetId: string }[] } };
    expect(body.data.items.length).toBe(1);
    expect(body.data.items[0]!.targetId).toBe(targetId);
  });
});
