import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "socrm-phase4-test-"));
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
let auth: Record<string, string>;

async function req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const init: RequestInit = { method, headers: { ...auth, ...extra } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await app.request(path, init);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

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
  auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
});

afterAll(() => {
  libsql.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("action.get", () => {
  it("returns full metadata for an action", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Inspect", email: "inspect@example.com" });
    const actionId = c.body.data.agentActionId;
    const res = await req("GET", `/v1/actions/${actionId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.operation).toBe("contact.create");
    expect(res.body.data.targetId).toBe(c.body.data.contact.id);
  });

  it("returns 404 for unknown action id", async () => {
    const res = await req("GET", "/v1/actions/act_01ABCDEFGHJKMNPQRSTVWXYZ12");
    expect(res.status).toBe(404);
  });
});

describe("schema.describe with reversibility", () => {
  it("classifies each op as reversible | one-way | read-only", async () => {
    const res = await app.request("/v1/schema");
    const body = (await res.json()) as {
      data: { operations: { operation: string; reversibility: string }[] };
    };
    const map = Object.fromEntries(body.data.operations.map((o) => [o.operation, o.reversibility]));
    expect(map["contact.create"]).toBe("reversible");
    expect(map["contact.delete"]).toBe("reversible");
    expect(map["contact.merge"]).toBe("one-way");
    expect(map["interaction.ingest_email"]).toBe("reversible");
    expect(map["action.undo"]).toBe("one-way");
    expect(map["contact.list"]).toBe("one-way"); // catalog default for non-mutations
  });
});

describe("action.undo — refusals", () => {
  it("refuses to undo a one-way operation (contact.merge)", async () => {
    const a = await req("POST", "/v1/contacts", { name: "MA", email: "ma@example.com" });
    const b = await req("POST", "/v1/contacts", { name: "MB", email: "mb@example.com" });
    const merge = await req("POST", "/v1/contacts/merge", {
      keepId: a.body.data.contact.id,
      mergeId: b.body.data.contact.id,
    });
    const mergeActionId = merge.body.data.agentActionId;
    const undo = await req("POST", `/v1/actions/${mergeActionId}/undo`);
    expect(undo.status).toBe(409);
    expect(undo.body.error.code).toBe("CONFLICT");
    expect(undo.body.error.message).toContain("one-way");
  });

  it("refuses to undo an action.undo", async () => {
    // create + undo it, then try to undo the undo
    const c = await req("POST", "/v1/contacts", { name: "Cycle", email: "cycle@example.com" });
    const createActionId = c.body.data.agentActionId;
    const u1 = await req("POST", `/v1/actions/${createActionId}/undo`);
    expect(u1.status).toBe(200);
    const u1ActionId = u1.body.data.agentActionId;
    const u2 = await req("POST", `/v1/actions/${u1ActionId}/undo`);
    expect(u2.status).toBe(409);
  });
});

describe("action.undo — contact.create reversal", () => {
  it("undoing contact.create removes the contact", async () => {
    const c = await req("POST", "/v1/contacts", { name: "TempC", email: "tempc@example.com" });
    const cid = c.body.data.contact.id;
    const aid = c.body.data.agentActionId;
    const undo = await req("POST", `/v1/actions/${aid}/undo`);
    expect(undo.status).toBe(200);
    const get = await req("GET", `/v1/contacts/${cid}`);
    expect(get.status).toBe(404);
  });
});

describe("action.undo — contact.update reversal", () => {
  it("restores the before-state of an update", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Original", email: "orig@example.com" });
    const cid = c.body.data.contact.id;
    const upd = await req("PATCH", `/v1/contacts/${cid}`, { name: "Changed", status: "customer" });
    const aid = upd.body.data.agentActionId;
    const undo = await req("POST", `/v1/actions/${aid}/undo`);
    expect(undo.status).toBe(200);
    const after = await req("GET", `/v1/contacts/${cid}`);
    expect(after.body.data.contact.name).toBe("Original");
    expect(after.body.data.contact.status).toBe("lead");
  });
});

describe("action.undo — contact.delete reversal (the showcase)", () => {
  it("restores a deleted contact with its identities", async () => {
    const c = await req("POST", "/v1/contacts", {
      name: "Restorable",
      email: "restore@example.com",
      phone: "+1234",
    });
    const cid = c.body.data.contact.id;
    const del = await req("DELETE", `/v1/contacts/${cid}`, undefined, { "X-Agent-Intent": "oops" });
    const aid = del.body.data.agentActionId;

    // Confirm gone
    expect((await req("GET", `/v1/contacts/${cid}`)).status).toBe(404);

    // Dry-run first
    const dry = await req("POST", `/v1/actions/${aid}/undo?dry_run=1`);
    expect(dry.status).toBe(200);
    expect(dry.body.data.dryRun).toBe(true);
    expect((dry.body.data.reversal as { willRestore: unknown }).willRestore).toBeDefined();

    // Real undo
    const undo = await req("POST", `/v1/actions/${aid}/undo`, undefined, { "X-Agent-Intent": "rollback" });
    expect(undo.status).toBe(200);
    expect(undo.body.data.reversal.restoredContactId).toBe(cid);
    expect((undo.body.data.reversal as { restoredIdentities: unknown[] }).restoredIdentities.length).toBe(2);

    const restored = await req("GET", `/v1/contacts/${cid}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.contact.name).toBe("Restorable");
    expect(restored.body.data.identities.length).toBe(2);

    // find_by_identity still works on the restored row
    const find = await req("GET", "/v1/contacts/find?kind=email&value=restore@example.com");
    expect(find.status).toBe(200);
    expect(find.body.data.contact.id).toBe(cid);
  });

  it("re-links orphaned interactions back to the restored contact", async () => {
    const c = await req("POST", "/v1/contacts", { name: "WithTimeline", email: "tl@example.com" });
    const cid = c.body.data.contact.id;
    const intRes = await req("POST", "/v1/interactions", {
      contactId: cid,
      kind: "call",
      subject: "Important call",
    });
    const iid = intRes.body.data.interaction.id;

    const del = await req("DELETE", `/v1/contacts/${cid}`);
    const undoableId = del.body.data.agentActionId;

    // Interaction now orphaned (contact_id NULL)
    const orphan = await req("GET", `/v1/interactions?contact_id=${cid}`);
    expect(orphan.body.data.items.length).toBe(0);

    await req("POST", `/v1/actions/${undoableId}/undo`);

    // Interaction re-linked
    const after = await req("GET", `/v1/interactions?contact_id=${cid}`);
    expect(after.body.data.items.length).toBe(1);
    expect(after.body.data.items[0].id).toBe(iid);
  });
});

describe("action.undo — identity reversal", () => {
  it("undo identity.add removes the identity", async () => {
    const c = await req("POST", "/v1/contacts", { name: "IA", email: "ia@example.com" });
    const cid = c.body.data.contact.id;
    const add = await req("POST", "/v1/identities", { contactId: cid, kind: "telegram", value: "@ia" });
    const aid = add.body.data.agentActionId;
    await req("POST", `/v1/actions/${aid}/undo`);
    const list = await req("GET", `/v1/identities?contact_id=${cid}`);
    expect(list.body.data.items.some((i: { kind: string }) => i.kind === "telegram")).toBe(false);
  });

  it("undo identity.remove restores it", async () => {
    const c = await req("POST", "/v1/contacts", { name: "IR", email: "ir@example.com" });
    const cid = c.body.data.contact.id;
    const list = await req("GET", `/v1/identities?contact_id=${cid}`);
    const idyId = list.body.data.items[0].id;
    const del = await req("DELETE", `/v1/identities/${idyId}`);
    const aid = del.body.data.agentActionId;
    await req("POST", `/v1/actions/${aid}/undo`);
    const after = await req("GET", `/v1/identities?contact_id=${cid}`);
    expect(after.body.data.items.some((i: { id: string }) => i.id === idyId)).toBe(true);
  });
});

describe("action.undo — account.update reversal", () => {
  it("restores before-state of account update", async () => {
    const orig = await req("GET", "/v1/account");
    const origName = orig.body.data.account.name;
    const upd = await req("PATCH", "/v1/account", { name: "ChangedAccount" });
    const aid = upd.body.data.agentActionId;
    await req("POST", `/v1/actions/${aid}/undo`);
    const after = await req("GET", "/v1/account");
    expect(after.body.data.account.name).toBe(origName);
  });
});

describe("action.undo — api_key reversal", () => {
  it("undo api_key.create revokes the key", async () => {
    const k = await req("POST", "/v1/api-keys", { label: "TempKey" });
    const aid = k.body.data.agentActionId;
    const kid = k.body.data.apiKey.id;
    await req("POST", `/v1/actions/${aid}/undo`);
    const list = await req("GET", "/v1/api-keys?include_revoked=1");
    const row = list.body.data.items.find((r: { id: string }) => r.id === kid);
    expect(row.revokedAt).not.toBeNull();
  });

  it("undo api_key.revoke un-revokes", async () => {
    const k = await req("POST", "/v1/api-keys", { label: "BackKey" });
    const kid = k.body.data.apiKey.id;
    const rev = await req("DELETE", `/v1/api-keys/${kid}`);
    const aid = rev.body.data.agentActionId;
    await req("POST", `/v1/actions/${aid}/undo`);
    const list = await req("GET", "/v1/api-keys");
    const row = list.body.data.items.find((r: { id: string }) => r.id === kid);
    expect(row.revokedAt).toBeNull();
  });
});

describe("action.undo — interaction reversal", () => {
  it("undo interaction.create deletes the interaction", async () => {
    const c = await req("POST", "/v1/contacts", { name: "IntO", email: "into@example.com" });
    const cid = c.body.data.contact.id;
    const i = await req("POST", "/v1/interactions", { contactId: cid, kind: "note", subject: "tmp" });
    const aid = i.body.data.agentActionId;
    await req("POST", `/v1/actions/${aid}/undo`);
    const list = await req("GET", `/v1/interactions?contact_id=${cid}`);
    expect(list.body.data.items.length).toBe(0);
  });

  it("undo interaction.delete restores it", async () => {
    const c = await req("POST", "/v1/contacts", { name: "IntD", email: "intd@example.com" });
    const cid = c.body.data.contact.id;
    const i = await req("POST", "/v1/interactions", { contactId: cid, kind: "call", subject: "keepme" });
    const iid = i.body.data.interaction.id;
    const del = await req("DELETE", `/v1/interactions/${iid}`);
    const aid = del.body.data.agentActionId;
    await req("POST", `/v1/actions/${aid}/undo`);
    const list = await req("GET", `/v1/interactions?contact_id=${cid}`);
    expect(list.body.data.items.some((x: { id: string }) => x.id === iid)).toBe(true);
  });

  it("undo interaction.ingest_email deletes interaction and (if created) the contact", async () => {
    const res = await req("POST", "/v1/interactions/ingest/email", {
      from: { name: "AutoCreated", email: "autocreate@example.com" },
      subject: "test",
    });
    expect(res.body.data.contactCreated).toBe(true);
    const cid = res.body.data.contact.id;
    const iid = res.body.data.interaction.id;
    const aid = res.body.data.agentActionId;

    const undo = await req("POST", `/v1/actions/${aid}/undo`);
    expect(undo.status).toBe(200);
    expect(undo.body.data.reversal.deletedInteractionId).toBe(iid);
    expect(undo.body.data.reversal.deletedContactId).toBe(cid);

    const find = await req("GET", "/v1/contacts/find?kind=email&value=autocreate@example.com");
    expect(find.status).toBe(404);
  });
});

describe("action.undo idempotency", () => {
  it("replaying an undo with the same key returns the cached result", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Idem", email: "idem-u@example.com" });
    const aid = c.body.data.agentActionId;
    const first = await req("POST", `/v1/actions/${aid}/undo`, undefined, { "Idempotency-Key": "u-1" });
    const second = await req("POST", `/v1/actions/${aid}/undo`, undefined, { "Idempotency-Key": "u-1" });
    expect(second.body.data.replayed).toBe(true);
  });
});
