import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "socrm-phase3-test-"));
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

describe("identity operations", () => {
  it("attaches a new identity to a contact and lists it back", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Pedro", email: "pedro@example.com" });
    const contactId = c.body.data.contact.id;
    const add = await req(
      "POST",
      "/v1/identities",
      { contactId, kind: "telegram", value: "@pedrog" },
      { "X-Agent-Intent": "linking telegram" },
    );
    expect(add.status).toBe(201);
    expect(add.body.data.identity.kind).toBe("telegram");
    expect(add.body.data.identity.value).toBe("@pedrog");

    const list = await req("GET", `/v1/identities?contact_id=${contactId}`);
    const kinds = list.body.data.items.map((i: { kind: string }) => i.kind).sort();
    expect(kinds).toEqual(["email", "telegram"]);
  });

  it("rejects duplicate identity across contacts in the same account", async () => {
    const a = await req("POST", "/v1/contacts", { name: "A" });
    const b = await req("POST", "/v1/contacts", { name: "B" });
    const idA = a.body.data.contact.id;
    const idB = b.body.data.contact.id;
    const first = await req("POST", "/v1/identities", { contactId: idA, kind: "whatsapp", value: "+507111" });
    expect(first.status).toBe(201);
    const second = await req("POST", "/v1/identities", { contactId: idB, kind: "whatsapp", value: "+507111" });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
    expect(second.body.error.hint).toContain("merge");
  });

  it("normalizes email value (case-insensitive) for the same-contact dedupe", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Mixed" });
    const id = c.body.data.contact.id;
    const first = await req("POST", "/v1/identities", { contactId: id, kind: "email", value: "Mixed@Example.com" });
    expect(first.status).toBe(201);
    expect(first.body.data.identity.value).toBe("mixed@example.com");
    const second = await req("POST", "/v1/identities", { contactId: id, kind: "email", value: "mixed@example.com" });
    expect(second.status).toBe(409);
  });

  it("removes an identity but preserves the contact", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Remov", email: "rem@example.com" });
    const cid = c.body.data.contact.id;
    const list = await req("GET", `/v1/identities?contact_id=${cid}`);
    const idyId = list.body.data.items[0].id;
    const del = await req("DELETE", `/v1/identities/${idyId}`);
    expect(del.status).toBe(200);
    const after = await req("GET", `/v1/contacts/${cid}`);
    expect(after.status).toBe(200);
    expect(after.body.data.identities.length).toBe(0);
  });
});

describe("contact.find_by_identity", () => {
  it("finds the contact via any of its identities", async () => {
    const create = await req("POST", "/v1/contacts", { name: "Findable", email: "findable@example.com" });
    const cid = create.body.data.contact.id;
    await req("POST", "/v1/identities", { contactId: cid, kind: "telegram", value: "@findable" });

    const byEmail = await req("GET", "/v1/contacts/find?kind=email&value=findable@example.com");
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.contact.id).toBe(cid);

    const byTg = await req("GET", "/v1/contacts/find?kind=telegram&value=@findable");
    expect(byTg.status).toBe(200);
    expect(byTg.body.data.contact.id).toBe(cid);
    expect(byTg.body.data.identity.kind).toBe("telegram");
  });

  it("finds case-insensitively for emails", async () => {
    await req("POST", "/v1/contacts", { name: "CaseInsens", email: "Case@Sensitive.com" });
    const res = await req("GET", "/v1/contacts/find?kind=email&value=CASE@SENSITIVE.COM");
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown identity", async () => {
    const res = await req("GET", "/v1/contacts/find?kind=email&value=ghost@nowhere.com");
    expect(res.status).toBe(404);
  });
});

describe("interaction.create + list", () => {
  it("creates a standalone interaction (no contact)", async () => {
    const res = await req("POST", "/v1/interactions", {
      kind: "note",
      subject: "Standalone note",
      body: "remember this",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.interaction.contactId).toBeNull();
  });

  it("creates a contact-linked interaction", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Linked", email: "linked@example.com" });
    const cid = c.body.data.contact.id;
    const res = await req("POST", "/v1/interactions", {
      contactId: cid,
      kind: "call",
      direction: "outbound",
      subject: "Discovery call",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.interaction.contactId).toBe(cid);

    const list = await req("GET", `/v1/interactions?contact_id=${cid}`);
    expect(list.body.data.items.length).toBe(1);
    expect(list.body.data.items[0].kind).toBe("call");
  });
});

describe("interaction.ingest_email", () => {
  it("auto-creates a contact when sender is unknown, attaches email identity", async () => {
    const res = await req(
      "POST",
      "/v1/interactions/ingest/email",
      {
        from: { name: "New Sender", email: "newsender@example.com" },
        subject: "Hello",
        body: "First contact",
      },
      { "X-Agent-Intent": "received via inbox webhook" },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.contactCreated).toBe(true);
    expect(res.body.data.contact.name).toBe("New Sender");
    expect(res.body.data.contact.primaryEmail).toBe("newsender@example.com");
    expect(res.body.data.identity.kind).toBe("email");
    expect(res.body.data.interaction.kind).toBe("email_in");
    expect(res.body.data.interaction.direction).toBe("inbound");

    const find = await req("GET", "/v1/contacts/find?kind=email&value=newsender@example.com");
    expect(find.status).toBe(200);
    expect(find.body.data.contact.id).toBe(res.body.data.contact.id);
  });

  it("links to existing contact when sender already known", async () => {
    const existing = await req("POST", "/v1/contacts", { name: "Existing", email: "exist@example.com" });
    const existingId = existing.body.data.contact.id;

    const res = await req("POST", "/v1/interactions/ingest/email", {
      from: { name: "Existing", email: "exist@example.com" },
      subject: "Another email",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.contactCreated).toBe(false);
    expect(res.body.data.contact.id).toBe(existingId);
  });

  it("normalizes sender email case", async () => {
    const a = await req("POST", "/v1/contacts", { name: "Cap", email: "cap@example.com" });
    const aid = a.body.data.contact.id;
    const res = await req("POST", "/v1/interactions/ingest/email", {
      from: { email: "CAP@Example.com" },
      subject: "Mixed case sender",
    });
    expect(res.body.data.contact.id).toBe(aid);
    expect(res.body.data.contactCreated).toBe(false);
  });

  it("refuses to create contact when createContactIfMissing=false and sender is unknown", async () => {
    const res = await req("POST", "/v1/interactions/ingest/email", {
      from: { email: "stranger@example.com" },
      createContactIfMissing: false,
    });
    expect(res.status).toBe(404);
  });

  it("dry-run returns plan without persisting", async () => {
    const res = await req("POST", "/v1/interactions/ingest/email?dry_run=1", {
      from: { email: "dryrun@example.com" },
      subject: "Imagined",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.contactCreated).toBe(true);
    const find = await req("GET", "/v1/contacts/find?kind=email&value=dryrun@example.com");
    expect(find.status).toBe(404);
  });

  it("supports idempotent replay (e.g. same Message-Id retried)", async () => {
    const payload = {
      from: { email: "idem@example.com" },
      subject: "Idem test",
      messageId: "<abc@example.com>",
    };
    const first = await req("POST", "/v1/interactions/ingest/email", payload, {
      "Idempotency-Key": "msg-abc",
    });
    expect(first.body.data.replayed).toBe(false);
    const replay = await req("POST", "/v1/interactions/ingest/email", payload, {
      "Idempotency-Key": "msg-abc",
    });
    expect(replay.body.data.replayed).toBe(true);
    expect(replay.body.data.interaction.id).toBe(first.body.data.interaction.id);
  });
});

describe("schema.describe lists Phase 3 operations", () => {
  it("includes identity, find_by_identity, interaction, ingest_email", async () => {
    const res = await app.request("/v1/schema");
    const body = (await res.json()) as { data: { operations: { operation: string }[] } };
    const ops = body.data.operations.map((o) => o.operation);
    expect(ops).toEqual(
      expect.arrayContaining([
        "identity.add",
        "identity.remove",
        "identity.list",
        "contact.find_by_identity",
        "interaction.create",
        "interaction.list",
        "interaction.ingest_email",
      ]),
    );
  });
});
