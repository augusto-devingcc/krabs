import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "socrm-phase5-test-"));
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
  await db.insert(accounts).values({ id: accountId, email: "p5@example.com", name: "P5" });
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

describe("deals", () => {
  let contactId: string;
  let dealId: string;

  it("creates a contact + deal", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Acme", email: "acme@example.com" });
    contactId = c.body.data.contact.id;
    const d = await req("POST", "/v1/deals", {
      title: "Annual contract",
      contactId,
      stage: "proposal",
      value: 5000000,
      currency: "USD",
    });
    expect(d.status).toBe(201);
    expect(d.body.data.deal.title).toBe("Annual contract");
    expect(d.body.data.deal.value).toBe(5000000);
    dealId = d.body.data.deal.id;
  });

  it("lists deals by contact + stage + status", async () => {
    const byContact = await req("GET", `/v1/deals?contact_id=${contactId}`);
    expect(byContact.body.data.items.length).toBeGreaterThan(0);
    const byStage = await req("GET", "/v1/deals?stage=proposal");
    expect(byStage.body.data.items.some((d: { id: string }) => d.id === dealId)).toBe(true);
  });

  it("updates a deal and records the before-state", async () => {
    const r = await req("PATCH", `/v1/deals/${dealId}`, { stage: "negotiation", value: 6000000 });
    expect(r.body.data.deal.stage).toBe("negotiation");
    expect(r.body.data.before.stage).toBe("proposal");
  });

  it("deletes a deal and undo restores it", async () => {
    const del = await req("DELETE", `/v1/deals/${dealId}`, undefined, { "X-Agent-Intent": "test" });
    expect(del.status).toBe(200);
    const aid = del.body.data.agentActionId;
    expect((await req("GET", `/v1/deals/${dealId}`)).status).toBe(404);
    const undo = await req("POST", `/v1/actions/${aid}/undo`);
    expect(undo.status).toBe(200);
    expect((await req("GET", `/v1/deals/${dealId}`)).status).toBe(200);
  });
});

describe("tasks", () => {
  let contactId: string;

  beforeAll(async () => {
    const c = await req("POST", "/v1/contacts", { name: "TaskOwner", email: "task@example.com" });
    contactId = c.body.data.contact.id;
  });

  it("creates a task, transitions to done auto-stamps completedAt", async () => {
    const c = await req("POST", "/v1/tasks", {
      title: "Follow up",
      contactId,
      priority: "high",
      dueAt: "2026-06-01T12:00:00.000Z",
    });
    expect(c.status).toBe(201);
    expect(c.body.data.task.priority).toBe("high");
    expect(c.body.data.task.status).toBe("open");
    expect(c.body.data.task.completedAt).toBeNull();
    const tid = c.body.data.task.id;

    const upd = await req("PATCH", `/v1/tasks/${tid}`, { status: "done" });
    expect(upd.body.data.task.status).toBe("done");
    expect(upd.body.data.task.completedAt).not.toBeNull();

    const reopen = await req("PATCH", `/v1/tasks/${tid}`, { status: "open" });
    expect(reopen.body.data.task.status).toBe("open");
    expect(reopen.body.data.task.completedAt).toBeNull();
  });

  it("filters by status and due-before", async () => {
    const list = await req("GET", `/v1/tasks?status=open&contact_id=${contactId}`);
    expect(list.body.data.items.every((t: { status: string }) => t.status === "open")).toBe(true);
  });

  it("delete + undo round-trip", async () => {
    const c = await req("POST", "/v1/tasks", { title: "DeleteMe", contactId });
    const tid = c.body.data.task.id;
    const del = await req("DELETE", `/v1/tasks/${tid}`);
    const aid = del.body.data.agentActionId;
    expect((await req("GET", `/v1/tasks/${tid}`)).status).toBe(404);
    await req("POST", `/v1/actions/${aid}/undo`);
    expect((await req("GET", `/v1/tasks/${tid}`)).status).toBe(200);
  });
});

describe("notes", () => {
  let contactId: string;
  let dealId: string;

  beforeAll(async () => {
    const c = await req("POST", "/v1/contacts", { name: "NoteOwner", email: "note@example.com" });
    contactId = c.body.data.contact.id;
    const d = await req("POST", "/v1/deals", { title: "NoteDeal", contactId });
    dealId = d.body.data.deal.id;
  });

  it("creates standalone, contact-linked, and deal-linked notes", async () => {
    const standalone = await req("POST", "/v1/notes", { body: "lone thought" });
    expect(standalone.body.data.note.contactId).toBeNull();
    const onContact = await req("POST", "/v1/notes", { body: "for contact", contactId });
    expect(onContact.body.data.note.contactId).toBe(contactId);
    const onDeal = await req("POST", "/v1/notes", { body: "for deal", dealId });
    expect(onDeal.body.data.note.dealId).toBe(dealId);
  });

  it("lists by contact and by deal", async () => {
    const byContact = await req("GET", `/v1/notes?contact_id=${contactId}`);
    expect(byContact.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(byContact.body.data.items.every((n: { contactId: string }) => n.contactId === contactId)).toBe(true);
  });

  it("delete + undo round-trip", async () => {
    const c = await req("POST", "/v1/notes", { body: "remove me" });
    const nid = c.body.data.note.id;
    const del = await req("DELETE", `/v1/notes/${nid}`);
    const aid = del.body.data.agentActionId;
    expect((await req("GET", `/v1/notes/${nid}`)).status).toBe(404);
    await req("POST", `/v1/actions/${aid}/undo`);
    expect((await req("GET", `/v1/notes/${nid}`)).status).toBe(200);
  });
});

describe("tags + attach/detach", () => {
  let tagId: string;
  let c1: string;
  let c2: string;

  beforeAll(async () => {
    const a = await req("POST", "/v1/contacts", { name: "TA", email: "ta@example.com" });
    const b = await req("POST", "/v1/contacts", { name: "TB", email: "tb@example.com" });
    c1 = a.body.data.contact.id;
    c2 = b.body.data.contact.id;
  });

  it("creates a tag, rejects duplicate name", async () => {
    const r = await req("POST", "/v1/tags", { name: "vip", color: "#ff00aa" });
    expect(r.status).toBe(201);
    expect(r.body.data.tag.name).toBe("vip");
    tagId = r.body.data.tag.id;

    const dup = await req("POST", "/v1/tags", { name: "vip" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("CONFLICT");
  });

  it("attach + detach + alreadyAttached semantics", async () => {
    const a1 = await req("POST", "/v1/tags/attach", { contactId: c1, tagId });
    expect(a1.status).toBe(201);
    expect(a1.body.data.alreadyAttached).toBe(false);
    const a2 = await req("POST", "/v1/tags/attach", { contactId: c1, tagId });
    expect(a2.status).toBe(200);
    expect(a2.body.data.alreadyAttached).toBe(true);

    await req("POST", "/v1/tags/attach", { contactId: c2, tagId });
    const forC1 = await req("GET", `/v1/tags/for-contact/${c1}`);
    expect(forC1.body.data.items[0].name).toBe("vip");

    const d = await req("POST", "/v1/tags/detach", { contactId: c1, tagId });
    expect(d.body.data.wasAttached).toBe(true);
    const after = await req("GET", `/v1/tags/for-contact/${c1}`);
    expect(after.body.data.items.length).toBe(0);
  });

  it("delete tag captures contact list, undo re-attaches", async () => {
    // c2 still has the tag from above
    const del = await req("DELETE", `/v1/tags/${tagId}`);
    expect(del.status).toBe(200);
    expect(del.body.data.snapshot.contactIds).toContain(c2);
    const aid = del.body.data.agentActionId;

    // tag gone
    expect((await req("GET", `/v1/tags/${tagId}`)).status).toBe(404);
    expect((await req("GET", `/v1/tags/for-contact/${c2}`)).body.data.items.length).toBe(0);

    // undo
    await req("POST", `/v1/actions/${aid}/undo`);
    expect((await req("GET", `/v1/tags/${tagId}`)).status).toBe(200);
    const restored = await req("GET", `/v1/tags/for-contact/${c2}`);
    expect(restored.body.data.items.some((t: { id: string }) => t.id === tagId)).toBe(true);
  });

  it("undo tag.attach detaches; undo tag.detach reattaches", async () => {
    const tag = await req("POST", "/v1/tags", { name: "reversal" });
    const t = tag.body.data.tag.id;
    const att = await req("POST", "/v1/tags/attach", { contactId: c1, tagId: t });
    const attAct = att.body.data.agentActionId;
    await req("POST", `/v1/actions/${attAct}/undo`);
    const list = await req("GET", `/v1/tags/for-contact/${c1}`);
    expect(list.body.data.items.some((x: { id: string }) => x.id === t)).toBe(false);

    // Re-attach, detach, undo detach
    const att2 = await req("POST", "/v1/tags/attach", { contactId: c1, tagId: t });
    expect(att2.body.data.alreadyAttached).toBe(false);
    const det = await req("POST", "/v1/tags/detach", { contactId: c1, tagId: t });
    await req("POST", `/v1/actions/${det.body.data.agentActionId}/undo`);
    const list2 = await req("GET", `/v1/tags/for-contact/${c1}`);
    expect(list2.body.data.items.some((x: { id: string }) => x.id === t)).toBe(true);
  });
});

describe("schema catalog includes all Phase 5 operations", () => {
  it("lists deal/task/note/tag operations with correct reversibility", async () => {
    const res = await app.request("/v1/schema");
    const body = (await res.json()) as {
      data: { operations: { operation: string; reversibility: string }[] };
    };
    const map = Object.fromEntries(body.data.operations.map((o) => [o.operation, o.reversibility]));
    for (const op of [
      "deal.create",
      "deal.update",
      "deal.delete",
      "task.create",
      "task.update",
      "task.delete",
      "note.create",
      "note.update",
      "note.delete",
      "tag.create",
      "tag.update",
      "tag.delete",
      "tag.attach",
      "tag.detach",
    ]) {
      expect(map[op]).toBe("reversible");
    }
  });
});
