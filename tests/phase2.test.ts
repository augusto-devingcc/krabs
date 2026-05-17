import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "socrm-phase2-test-"));
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
let accountId: string;
let auth: { Authorization: string; "Content-Type": string };

async function req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const init: RequestInit = {
    method,
    headers: { ...auth, ...extra },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await app.request(path, init);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  accountId = newId("account");
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

  auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
});

afterAll(() => {
  libsql.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("schema.describe", () => {
  it("is publicly readable and lists the operations catalog", async () => {
    const res = await app.request("/v1/schema");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { operations: { operation: string; destructive: boolean }[] };
    };
    const ops = body.data.operations.map((o) => o.operation);
    expect(ops).toContain("contact.create");
    expect(ops).toContain("contact.delete");
    expect(ops).toContain("contact.merge");
    expect(ops).toContain("account.update");
    expect(ops).toContain("api_key.revoke");
    const destrOps = body.data.operations.filter((o) => o.destructive).map((o) => o.operation);
    expect(destrOps).toEqual(expect.arrayContaining(["contact.delete", "contact.merge", "api_key.revoke"]));
  });
});

describe("contact.list with pagination + filters", () => {
  it("lists with cursor pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await req("POST", "/v1/contacts", { name: `Bulk ${i}`, email: `bulk${i}@example.com` });
    }
    const page1 = await req("GET", "/v1/contacts?limit=2");
    expect(page1.status).toBe(200);
    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.nextCursor).not.toBeNull();
    const page2 = await req("GET", `/v1/contacts?limit=2&cursor=${page1.body.data.nextCursor}`);
    expect(page2.body.data.items.length).toBe(2);
    expect(page2.body.data.items[0].id).not.toBe(page1.body.data.items[0].id);
  });

  it("filters by q (search)", async () => {
    await req("POST", "/v1/contacts", { name: "Searchable Unicorn", email: "unicorn@example.com" });
    const res = await req("GET", "/v1/contacts?q=unicorn");
    expect(res.body.data.items.some((c: { name: string }) => c.name === "Searchable Unicorn")).toBe(true);
  });

  it("filters by status", async () => {
    await req("POST", "/v1/contacts", { name: "Customer Person", email: "cust@example.com", status: "customer" });
    const res = await req("GET", "/v1/contacts?status=customer");
    expect(res.body.data.items.every((c: { status: string }) => c.status === "customer")).toBe(true);
  });
});

describe("contact.update", () => {
  it("updates fields, attaches new identity for changed email, records action", async () => {
    const create = await req("POST", "/v1/contacts", { name: "Old", email: "old@example.com" });
    const id = create.body.data.contact.id;

    const upd = await req(
      "PATCH",
      `/v1/contacts/${id}`,
      { name: "New", primaryEmail: "new@example.com", status: "customer" },
      { "X-Agent-Intent": "rename + email change" },
    );
    expect(upd.status).toBe(200);
    expect(upd.body.data.contact.name).toBe("New");
    expect(upd.body.data.contact.primaryEmail).toBe("new@example.com");
    expect(upd.body.data.contact.status).toBe("customer");
    expect(upd.body.data.before.name).toBe("Old");

    const fetch = await req("GET", `/v1/contacts/${id}`);
    const emailIdentities = fetch.body.data.identities.filter((i: { kind: string }) => i.kind === "email");
    expect(emailIdentities.length).toBeGreaterThanOrEqual(2);
  });

  it("supports idempotent replay", async () => {
    const create = await req("POST", "/v1/contacts", { name: "Idem", email: "idem-upd@example.com" });
    const id = create.body.data.contact.id;
    const first = await req("PATCH", `/v1/contacts/${id}`, { name: "First" }, { "Idempotency-Key": "upd-1" });
    expect(first.body.data.replayed).toBe(false);
    const replay = await req("PATCH", `/v1/contacts/${id}`, { name: "Different" }, { "Idempotency-Key": "upd-1" });
    expect(replay.body.data.replayed).toBe(true);
    expect(replay.body.data.contact.name).toBe("First");
  });

  it("dry-run does not persist", async () => {
    const create = await req("POST", "/v1/contacts", { name: "DryUpd", email: "dryupd@example.com" });
    const id = create.body.data.contact.id;
    const dry = await req("PATCH", `/v1/contacts/${id}?dry_run=1`, { name: "Imagined" });
    expect(dry.body.data.dryRun).toBe(true);
    expect(dry.body.data.contact.name).toBe("Imagined");
    const fetch = await req("GET", `/v1/contacts/${id}`);
    expect(fetch.body.data.contact.name).toBe("DryUpd");
  });
});

describe("contact.delete", () => {
  it("dry-run returns snapshot without removing", async () => {
    const create = await req("POST", "/v1/contacts", { name: "ToDelete", email: "del@example.com" });
    const id = create.body.data.contact.id;
    const dry = await req("DELETE", `/v1/contacts/${id}?dry_run=1`);
    expect(dry.body.data.dryRun).toBe(true);
    expect(dry.body.data.snapshot.contact.id).toBe(id);
    const stillThere = await req("GET", `/v1/contacts/${id}`);
    expect(stillThere.status).toBe(200);
  });

  it("hard-deletes, cascade to identities, but action log preserves snapshot", async () => {
    const create = await req("POST", "/v1/contacts", {
      name: "GoneSoon",
      email: "gone@example.com",
      phone: "+1234567890",
    });
    const id = create.body.data.contact.id;
    const del = await req("DELETE", `/v1/contacts/${id}`, undefined, { "X-Agent-Intent": "test cleanup" });
    expect(del.status).toBe(200);
    expect(del.body.data.snapshot.identities.length).toBe(2);

    const gone = await req("GET", `/v1/contacts/${id}`);
    expect(gone.status).toBe(404);

    const actions = await req("GET", `/v1/actions?target_id=${id}`);
    const deleteAction = actions.body.data.items.find(
      (a: { operation: string }) => a.operation === "contact.delete",
    );
    expect(deleteAction).toBeDefined();
    expect(deleteAction.intent).toBe("test cleanup");
    expect(deleteAction.metadata.snapshot.contact.name).toBe("GoneSoon");
    expect(deleteAction.metadata.snapshot.identities.length).toBe(2);
  });

  it("idempotent replay returns same response without re-attempting", async () => {
    const create = await req("POST", "/v1/contacts", { name: "Vanish", email: "vanish@example.com" });
    const id = create.body.data.contact.id;
    const first = await req("DELETE", `/v1/contacts/${id}`, undefined, { "Idempotency-Key": "del-1" });
    expect(first.status).toBe(200);
    const replay = await req("DELETE", `/v1/contacts/${id}`, undefined, { "Idempotency-Key": "del-1" });
    expect(replay.status).toBe(200);
    expect(replay.body.data.replayed).toBe(true);
    expect(replay.body.data.deletedId).toBe(id);
  });
});

describe("contact.merge", () => {
  it("dry-run returns the migration plan", async () => {
    const a = await req("POST", "/v1/contacts", { name: "Keep", email: "keep@example.com" });
    const b = await req("POST", "/v1/contacts", { name: "Merge", email: "merge@example.com", phone: "+5556" });
    const keepId = a.body.data.contact.id;
    const mergeId = b.body.data.contact.id;
    const dry = await req("POST", "/v1/contacts/merge?dry_run=1", { keepId, mergeId });
    expect(dry.body.data.dryRun).toBe(true);
    expect(dry.body.data.migratedIdentities.length).toBe(2);
    const stillKept = await req("GET", `/v1/contacts/${mergeId}`);
    expect(stillKept.status).toBe(200);
  });

  it("merges and deletes the source", async () => {
    const a = await req("POST", "/v1/contacts", { name: "Keep2", email: "keep2@example.com" });
    const b = await req("POST", "/v1/contacts", { name: "Merge2", email: "merge2@example.com", phone: "+999" });
    const keepId = a.body.data.contact.id;
    const mergeId = b.body.data.contact.id;
    const m = await req(
      "POST",
      "/v1/contacts/merge",
      { keepId, mergeId },
      { "X-Agent-Intent": "dedupe" },
    );
    expect(m.status).toBe(200);
    expect(m.body.data.migratedIdentities.length).toBe(2);

    const gone = await req("GET", `/v1/contacts/${mergeId}`);
    expect(gone.status).toBe(404);

    const after = await req("GET", `/v1/contacts/${keepId}`);
    const kinds = after.body.data.identities.map((i: { kind: string }) => i.kind).sort();
    expect(kinds).toEqual(expect.arrayContaining(["email", "phone"]));
  });

  it("rejects merging a contact with itself", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Self", email: "self@example.com" });
    const id = c.body.data.contact.id;
    const res = await req("POST", "/v1/contacts/merge", { keepId: id, mergeId: id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("account.update", () => {
  it("updates the account name and records an action", async () => {
    const upd = await req("PATCH", "/v1/account", { name: "New Owner Name" }, { "X-Agent-Intent": "rename" });
    expect(upd.status).toBe(200);
    expect(upd.body.data.account.name).toBe("New Owner Name");
    expect(upd.body.data.before.name).toBe("Owner");

    const actions = await req("GET", "/v1/actions?target_kind=account");
    expect(actions.body.data.items[0].operation).toBe("account.update");
  });
});

describe("api_key lifecycle", () => {
  let createdKeyId: string;
  let createdToken: string;

  it("creates a new key with plaintext returned once", async () => {
    const res = await req(
      "POST",
      "/v1/api-keys",
      { label: "Second agent" },
      { "X-Agent-Intent": "provision a new MCP client" },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^krabs_sk_/);
    expect(res.body.data.apiKey.label).toBe("Second agent");
    createdKeyId = res.body.data.apiKey.id;
    createdToken = res.body.data.token;
  });

  it("the new token authenticates", async () => {
    const probe = await app.request("/v1/me", {
      headers: { Authorization: `Bearer ${createdToken}` },
    });
    expect(probe.status).toBe(200);
  });

  it("lists active keys", async () => {
    const res = await req("GET", "/v1/api-keys");
    const ids = res.body.data.items.map((k: { id: string }) => k.id);
    expect(ids).toContain(createdKeyId);
  });

  it("revokes the key; subsequent calls fail", async () => {
    const rev = await req("DELETE", `/v1/api-keys/${createdKeyId}`, undefined, {
      "X-Agent-Intent": "rotation test",
    });
    expect(rev.status).toBe(200);
    expect(rev.body.data.apiKey.revokedAt).not.toBeNull();

    const probe = await app.request("/v1/me", {
      headers: { Authorization: `Bearer ${createdToken}` },
    });
    expect(probe.status).toBe(401);
  });

  it("revoking a revoked key returns current state, not an error", async () => {
    const rev = await req("DELETE", `/v1/api-keys/${createdKeyId}`);
    expect(rev.status).toBe(200);
  });
});
