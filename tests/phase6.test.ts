import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = mkdtempSync(join(tmpdir(), "socrm-phase6-test-"));
const dbPath = join(tmp, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db, libsql } = await import("@/db/client.js");
const { accounts, apiKeys } = await import("@/db/schema.js");
const { buildApp } = await import("@/api/app.js");
const { newId } = await import("@/contract/ids.js");
const { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } = await import("@/lib/hash.js");
const { parseCsv, stringifyCsv, rowsToRecords } = await import("@/lib/csv.js");
const { parseVCard } = await import("@/lib/vcard.js");

const app = buildApp();
let token: string;
let auth: Record<string, string>;

async function req(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const init: RequestInit = { method, headers: { ...auth, ...extra } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await app.request(path, init);
  const text = await res.text();
  return { status: res.status, body: text ? (text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text) : null };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  const accountId = newId("account");
  const apiKeyId = newId("apiKey");
  token = generateApiKeyPlaintext();
  await db.insert(accounts).values({ id: accountId, email: "p6@example.com", name: "P6" });
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

describe("CSV parser", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas and embedded newlines", () => {
    const text = `name,note\n"Doe, John","line1\nline2"\nAda,Plain`;
    const rows = parseCsv(text);
    expect(rows[1]).toEqual(["Doe, John", "line1\nline2"]);
    expect(rows[2]).toEqual(["Ada", "Plain"]);
  });

  it("handles escaped double quotes", () => {
    const text = `a\n"He said ""hi"""`;
    expect(parseCsv(text)).toEqual([["a"], ['He said "hi"']]);
  });

  it("stringifies and round-trips", () => {
    const original = [
      ["id", "name", "note"],
      ["1", "Doe, John", 'said "hi"'],
      ["2", "Plain", "line1\nline2"],
    ];
    const text = stringifyCsv(original);
    expect(parseCsv(text)).toEqual(original);
  });

  it("rowsToRecords skips empty rows and trims headers", () => {
    const r = rowsToRecords([
      [" Name ", " Email "],
      ["Ada", "ada@x"],
      ["", ""],
      ["Bob", "bob@x"],
    ]);
    expect(r.headers).toEqual(["Name", "Email"]);
    expect(r.records.length).toBe(2);
    expect(r.records[0]).toEqual({ Name: "Ada", Email: "ada@x" });
  });
});

describe("vCard parser", () => {
  it("parses vCard 3.0 with FN/EMAIL/TEL/ORG", () => {
    const vc = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Ada Lovelace",
      "N:Lovelace;Ada;;;",
      "EMAIL;TYPE=WORK:ada@example.com",
      "TEL;TYPE=CELL:+1-555-0100",
      "ORG:Analytical Engines",
      "TITLE:Mathematician",
      "URL;TYPE=linkedin:https://linkedin.com/in/ada",
      "END:VCARD",
    ].join("\n");
    const parsed = parseVCard(vc);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe("Ada Lovelace");
    expect(parsed!.org).toBe("Analytical Engines");
    expect(parsed!.title).toBe("Mathematician");
    const kinds = parsed!.identities.map((i) => i.kind).sort();
    expect(kinds).toEqual(["email", "linkedin", "phone"]);
  });

  it("falls back to N when FN missing", () => {
    const vc = "BEGIN:VCARD\nN:Smith;John;;;\nEMAIL:js@x.com\nEND:VCARD";
    const parsed = parseVCard(vc);
    expect(parsed!.name).toBe("John Smith");
  });

  it("returns null for invalid input", () => {
    expect(parseVCard("not a vcard")).toBeNull();
  });
});

describe("contact.import_csv", () => {
  it("auto-detects columns and creates contacts", async () => {
    const csv = `Full Name,Email Address,Phone\nAda Lovelace,ada@example.com,+1-555-0001\nGrace Hopper,grace@example.com,+1-555-0002\n`;
    const r = await req(
      "POST",
      "/v1/contacts/import",
      { csv },
      { "X-Agent-Intent": "import from old CRM" },
    );
    expect(r.status).toBe(200);
    expect(r.body.data.totalRows).toBe(2);
    expect(r.body.data.created).toBe(2);
    expect(r.body.data.columnMap.name).toBe("Full Name");
    expect(r.body.data.columnMap.email).toBe("Email Address");
    expect(r.body.data.createdContactIds.length).toBe(2);

    // Verify the contacts exist via find_by_identity
    const find = await req("GET", "/v1/contacts/find?kind=email&value=ada@example.com");
    expect(find.status).toBe(200);
  });

  it("skips rows whose identity already exists", async () => {
    const csv = `name,email\nDup,ada@example.com\nNew Person,fresh@example.com\n`;
    const r = await req("POST", "/v1/contacts/import", { csv });
    expect(r.body.data.totalRows).toBe(2);
    expect(r.body.data.created).toBe(1);
    expect(r.body.data.skipped).toBe(1);
  });

  it("dry-run does not persist", async () => {
    const csv = `name,email\nGhost,ghost@example.com\n`;
    const r = await req("POST", "/v1/contacts/import?dry_run=1", { csv });
    expect(r.body.data.dryRun).toBe(true);
    expect(r.body.data.created).toBe(1);
    const find = await req("GET", "/v1/contacts/find?kind=email&value=ghost@example.com");
    expect(find.status).toBe(404);
  });

  it("batch undo deletes all created contacts", async () => {
    const csv = `name,email\nBatch1,b1@example.com\nBatch2,b2@example.com\nBatch3,b3@example.com\n`;
    const imp = await req("POST", "/v1/contacts/import", { csv });
    const aid = imp.body.data.agentActionId;
    const ids = imp.body.data.createdContactIds;
    expect(ids.length).toBe(3);

    for (const id of ids) expect((await req("GET", `/v1/contacts/${id}`)).status).toBe(200);

    const undo = await req("POST", `/v1/actions/${aid}/undo`);
    expect(undo.status).toBe(200);
    expect(undo.body.data.reversal.deletedContacts).toBe(3);

    for (const id of ids) expect((await req("GET", `/v1/contacts/${id}`)).status).toBe(404);
  });

  it("onConflict='link' attaches extra identities to existing contact", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Linkable", email: "linkable@example.com" });
    const cid = c.body.data.contact.id;
    const csv = `name,email,phone\nLinkable,linkable@example.com,+507-111-2222\n`;
    const imp = await req("POST", "/v1/contacts/import", { csv, onConflict: "link" });
    expect(imp.body.data.linked).toBe(1);
    expect(imp.body.data.created).toBe(0);

    const list = await req("GET", `/v1/identities?contact_id=${cid}`);
    expect(list.body.data.items.some((i: { kind: string; value: string }) => i.kind === "phone" && i.value === "+507-111-2222")).toBe(true);
  });
});

describe("contact.ingest_vcard", () => {
  it("creates a new contact + identities when no match", async () => {
    const vc = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:New Card",
      "EMAIL:newcard@example.com",
      "TEL:+507-333-4444",
      "URL;TYPE=linkedin:https://linkedin.com/in/newcard",
      "END:VCARD",
    ].join("\n");
    const r = await req("POST", "/v1/contacts/ingest/vcard", { vcard: vc }, { "X-Agent-Intent": "scan business card" });
    expect(r.status).toBe(201);
    expect(r.body.data.contactCreated).toBe(true);
    expect(r.body.data.contact.name).toBe("New Card");
    const kinds = r.body.data.identities.map((i: { kind: string }) => i.kind).sort();
    expect(kinds).toEqual(["email", "linkedin", "phone"]);
  });

  it("links to existing contact by any identity (e.g. phone) and adds new ones", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Existing", email: "exist-vc@example.com", phone: "+507-555-1234" });
    const cid = c.body.data.contact.id;

    const vc = [
      "BEGIN:VCARD",
      "FN:Different Name (will be ignored)",
      "TEL:+507-555-1234", // same phone — should match
      "URL;TYPE=twitter:https://twitter.com/existing",
      "END:VCARD",
    ].join("\n");
    const r = await req("POST", "/v1/contacts/ingest/vcard", { vcard: vc });
    expect(r.status).toBe(200);
    expect(r.body.data.contactCreated).toBe(false);
    expect(r.body.data.contact.id).toBe(cid);
    expect(r.body.data.addedIdentityIds.length).toBe(1); // twitter only
    const list = await req("GET", `/v1/identities?contact_id=${cid}`);
    expect(list.body.data.items.some((i: { kind: string }) => i.kind === "twitter")).toBe(true);
  });

  it("undo of vcard ingest: contact was created → delete contact + identities", async () => {
    const vc = "BEGIN:VCARD\nFN:Undoable\nEMAIL:undoable-vc@example.com\nEND:VCARD";
    const r = await req("POST", "/v1/contacts/ingest/vcard", { vcard: vc });
    const aid = r.body.data.agentActionId;
    const cid = r.body.data.contact.id;
    const undo = await req("POST", `/v1/actions/${aid}/undo`);
    expect(undo.status).toBe(200);
    expect((await req("GET", `/v1/contacts/${cid}`)).status).toBe(404);
  });

  it("undo of vcard ingest: contact was linked → only remove added identities, keep contact", async () => {
    const c = await req("POST", "/v1/contacts", { name: "Keep", email: "keep-vc@example.com" });
    const cid = c.body.data.contact.id;
    const vc = "BEGIN:VCARD\nEMAIL:keep-vc@example.com\nURL;TYPE=instagram:https://instagram.com/keep\nEND:VCARD";
    const r = await req("POST", "/v1/contacts/ingest/vcard", { vcard: vc });
    expect(r.body.data.contactCreated).toBe(false);
    const aid = r.body.data.agentActionId;

    await req("POST", `/v1/actions/${aid}/undo`);
    // Contact still there
    expect((await req("GET", `/v1/contacts/${cid}`)).status).toBe(200);
    // Instagram identity gone
    const list = await req("GET", `/v1/identities?contact_id=${cid}`);
    expect(list.body.data.items.some((i: { kind: string }) => i.kind === "instagram")).toBe(false);
  });
});

describe("account.export", () => {
  it("returns full account dump structure", async () => {
    const res = await req("GET", "/v1/account/export");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.schemaVersion).toBe("1");
    expect(d.account.id).toMatch(/^acc_/);
    expect(Array.isArray(d.contacts)).toBe(true);
    expect(Array.isArray(d.identities)).toBe(true);
    expect(Array.isArray(d.interactions)).toBe(true);
    expect(Array.isArray(d.deals)).toBe(true);
    expect(Array.isArray(d.tasks)).toBe(true);
    expect(Array.isArray(d.notes)).toBe(true);
    expect(Array.isArray(d.tags)).toBe(true);
    expect(d.actions).not.toBeNull();
  });

  it("incremental export with since filter narrows results", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const res = await req("GET", `/v1/account/export?since=${encodeURIComponent(future)}`);
    expect(res.body.data.contacts.length).toBe(0);
    expect(res.body.data.identities.length).toBe(0);
  });

  it("include_actions=0 omits the audit log", async () => {
    const res = await req("GET", "/v1/account/export?include_actions=0");
    expect(res.body.data.actions).toBeNull();
  });
});

describe("contact.export_csv", () => {
  it("returns parseable CSV with the expected columns", async () => {
    const res = await app.request("/v1/contacts/export.csv", { headers: auth });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await res.text();
    const rows = parseCsv(text);
    expect(rows[0]).toEqual([
      "id",
      "name",
      "primary_email",
      "primary_phone",
      "status",
      "created_at",
      "updated_at",
      "identities",
    ]);
    expect(rows.length).toBeGreaterThan(1);
  });
});

describe("schema catalog lists Phase 6 ops", () => {
  it("includes import/export ops with correct reversibility", async () => {
    const res = await app.request("/v1/schema");
    const body = (await res.json()) as { data: { operations: { operation: string; reversibility: string }[] } };
    const map = Object.fromEntries(body.data.operations.map((o) => [o.operation, o.reversibility]));
    expect(map["contact.import_csv"]).toBe("reversible");
    expect(map["contact.ingest_vcard"]).toBe("reversible");
    expect(map["account.export"]).toBe("one-way"); // read-only ops fall to default in the map
    expect(map["contact.export_csv"]).toBe("one-way");
  });
});
