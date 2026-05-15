import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db/client.js";
import {
  accounts,
  agentActions,
  apiKeys,
  contacts,
  contactTags,
  deals,
  identities,
  interactions,
  notes,
  tags,
  tasks,
} from "@/db/schema.js";
import { ApiError } from "@/contract/errors.js";
import { newId } from "@/contract/ids.js";
import { parseCsv, rowsToRecords, stringifyCsv } from "@/lib/csv.js";
import { parseVCard, type ParsedVCardIdentity } from "@/lib/vcard.js";
import type { Contact } from "@/contract/schemas/contact.js";
import type { Identity } from "@/contract/schemas/identity.js";
import type {
  ContactImportCsvInput,
  VCardIngestInput,
  ExportAccountFilters,
} from "@/contract/schemas/import-export.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

// ───────────────────────────────────────── CSV import

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "fullname", "contact name", "contact", "display name"],
  email: ["email", "e-mail", "email address", "primary email", "work email", "personal email"],
  phone: ["phone", "telephone", "tel", "mobile", "cell", "primary phone", "phone number"],
  status: ["status", "lifecycle", "stage"],
};

function autoMapHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const a of aliases) {
      const idx = lower.indexOf(a);
      if (idx >= 0) {
        result[field] = headers[idx]!;
        break;
      }
    }
  }
  return result;
}

export type ImportCsvRowResult =
  | { row: number; outcome: "created"; contactId: string }
  | { row: number; outcome: "linked"; contactId: string; addedIdentityIds: string[] }
  | { row: number; outcome: "skipped"; reason: string }
  | { row: number; outcome: "error"; error: string };

export type ImportContactsCsvResult = {
  totalRows: number;
  created: number;
  linked: number;
  skipped: number;
  errors: number;
  createdContactIds: string[];
  createdIdentityIds: string[];
  rows: ImportCsvRowResult[];
  columnMap: Record<string, string>;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

export async function importContactsCsv(
  ctx: CallerContext,
  input: ContactImportCsvInput,
  options: MutationOptions = {},
): Promise<ImportContactsCsvResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<ImportContactsCsvResult>(ctx, idempotencyKey, "contact.import_csv");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const parsed = parseCsv(input.csv);
  if (parsed.length < 2) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "CSV must have a header row and at least one data row",
    });
  }
  const { headers, records } = rowsToRecords(parsed);
  const mappingRaw = input.columnMap;
  const mapping: Record<string, string> = mappingRaw
    ? Object.fromEntries(Object.entries(mappingRaw).filter(([, v]) => v !== undefined) as [string, string][])
    : autoMapHeaders(headers);

  if (!mapping.name && !mapping.email && !mapping.phone) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Could not auto-detect any of name/email/phone columns",
      hint: "Pass columnMap explicitly with at least one of these fields",
    });
  }

  const onConflict = input.onConflict ?? "skip";
  const defaultStatus = input.defaultStatus ?? "lead";
  const now = new Date().toISOString();

  // Pre-load all existing identities for this account so we can dedupe in-memory
  const existingIdentities = await db
    .select({
      id: identities.id,
      contactId: identities.contactId,
      kind: identities.kind,
      value: identities.value,
    })
    .from(identities)
    .where(eq(identities.accountId, ctx.accountId));
  const identityMap = new Map<string, { contactId: string }>();
  for (const i of existingIdentities) {
    identityMap.set(`${i.kind}:${i.value}`, { contactId: i.contactId });
  }

  type Plan =
    | { kind: "create"; row: number; rowIndex: number; contact: Contact; identities: Identity[] }
    | { kind: "link"; row: number; rowIndex: number; contactId: string; identities: Identity[] }
    | { kind: "skip"; row: number; rowIndex: number; reason: string }
    | { kind: "error"; row: number; rowIndex: number; error: string };

  const plans: Plan[] = [];
  const seenInBatch = new Map<string, string>(); // kind:value → contactId (assigned within this batch)

  records.forEach((rec, idx) => {
    const rowNumber = idx + 2; // 1-indexed + header
    const name = mapping.name ? (rec[mapping.name] ?? "").trim() : "";
    const email = mapping.email ? (rec[mapping.email] ?? "").trim() : "";
    const phone = mapping.phone ? (rec[mapping.phone] ?? "").trim() : "";
    const statusRaw = mapping.status ? (rec[mapping.status] ?? "").trim() : "";

    if (!name && !email && !phone) {
      plans.push({ kind: "skip", row: rowNumber, rowIndex: idx, reason: "Empty row" });
      return;
    }

    const emailKey = email ? `email:${normalizeEmail(email)}` : null;
    const phoneKey = phone ? `phone:${phone}` : null;

    // Check pre-existing conflicts (DB-side)
    const collidingKey =
      (emailKey && (identityMap.has(emailKey) || seenInBatch.has(emailKey)) ? emailKey : null) ??
      (phoneKey && (identityMap.has(phoneKey) || seenInBatch.has(phoneKey)) ? phoneKey : null);

    if (collidingKey) {
      const existingContactId =
        identityMap.get(collidingKey)?.contactId ?? seenInBatch.get(collidingKey)!;

      if (onConflict === "skip") {
        plans.push({
          kind: "skip",
          row: rowNumber,
          rowIndex: idx,
          reason: `Identity already exists on contact ${existingContactId}`,
        });
        return;
      }
      // onConflict === 'link' — attach the row's OTHER identities to that contact
      const extraIdentities: Identity[] = [];
      if (emailKey && !identityMap.has(emailKey) && !seenInBatch.has(emailKey)) {
        const idy: Identity = {
          id: newId("identity"),
          accountId: ctx.accountId,
          contactId: existingContactId,
          kind: "email",
          value: normalizeEmail(email),
          confidence: 100,
          createdAt: now,
        };
        extraIdentities.push(idy);
        seenInBatch.set(emailKey, existingContactId);
      }
      if (phoneKey && !identityMap.has(phoneKey) && !seenInBatch.has(phoneKey)) {
        const idy: Identity = {
          id: newId("identity"),
          accountId: ctx.accountId,
          contactId: existingContactId,
          kind: "phone",
          value: phone,
          confidence: 100,
          createdAt: now,
        };
        extraIdentities.push(idy);
        seenInBatch.set(phoneKey, existingContactId);
      }
      plans.push({
        kind: "link",
        row: rowNumber,
        rowIndex: idx,
        contactId: existingContactId,
        identities: extraIdentities,
      });
      return;
    }

    // Create a new contact
    const contactId = newId("contact");
    const rowIdentities: Identity[] = [];
    if (email) {
      rowIdentities.push({
        id: newId("identity"),
        accountId: ctx.accountId,
        contactId,
        kind: "email",
        value: normalizeEmail(email),
        confidence: 100,
        createdAt: now,
      });
      seenInBatch.set(`email:${normalizeEmail(email)}`, contactId);
    }
    if (phone) {
      rowIdentities.push({
        id: newId("identity"),
        accountId: ctx.accountId,
        contactId,
        kind: "phone",
        value: phone,
        confidence: 100,
        createdAt: now,
      });
      seenInBatch.set(`phone:${phone}`, contactId);
    }

    const status = (["lead", "prospect", "customer", "archived"] as const).includes(statusRaw as never)
      ? (statusRaw as Contact["status"])
      : defaultStatus;

    const contact: Contact = {
      id: contactId,
      accountId: ctx.accountId,
      name: name || email || phone || "(unnamed)",
      primaryEmail: email ? normalizeEmail(email) : null,
      primaryPhone: phone || null,
      status,
      customFields: null,
      createdAt: now,
      updatedAt: now,
    };

    plans.push({ kind: "create", row: rowNumber, rowIndex: idx, contact, identities: rowIdentities });
  });

  const createdContactIds: string[] = plans.flatMap((p) => (p.kind === "create" ? [p.contact.id] : []));
  const createdIdentityIds: string[] = plans.flatMap((p) =>
    p.kind === "create" ? p.identities.map((i) => i.id) : p.kind === "link" ? p.identities.map((i) => i.id) : [],
  );

  const rowResults: ImportCsvRowResult[] = plans.map((p) => {
    if (p.kind === "create") return { row: p.row, outcome: "created", contactId: p.contact.id };
    if (p.kind === "link")
      return {
        row: p.row,
        outcome: "linked",
        contactId: p.contactId,
        addedIdentityIds: p.identities.map((i) => i.id),
      };
    if (p.kind === "skip") return { row: p.row, outcome: "skipped", reason: p.reason };
    return { row: p.row, outcome: "error", error: p.error };
  });

  const summary: Omit<ImportContactsCsvResult, "agentActionId" | "dryRun" | "replayed"> = {
    totalRows: records.length,
    created: rowResults.filter((r) => r.outcome === "created").length,
    linked: rowResults.filter((r) => r.outcome === "linked").length,
    skipped: rowResults.filter((r) => r.outcome === "skipped").length,
    errors: rowResults.filter((r) => r.outcome === "error").length,
    createdContactIds,
    createdIdentityIds,
    rows: rowResults,
    columnMap: mapping,
  };

  if (dryRun) {
    return { ...summary, agentActionId: null, dryRun: true, replayed: false };
  }

  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    for (const p of plans) {
      if (p.kind === "create") {
        await tx.insert(contacts).values({
          id: p.contact.id,
          accountId: p.contact.accountId,
          name: p.contact.name,
          primaryEmail: p.contact.primaryEmail,
          primaryPhone: p.contact.primaryPhone,
          status: p.contact.status,
          customFields: null,
          createdAt: p.contact.createdAt,
          updatedAt: p.contact.updatedAt,
        });
        for (const idy of p.identities) {
          await tx.insert(identities).values(idy);
        }
      } else if (p.kind === "link") {
        for (const idy of p.identities) {
          await tx.insert(identities).values(idy);
        }
      }
    }

    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "contact.import_csv",
      targetKind: "account",
      targetId: ctx.accountId,
      metadata: {
        totalRows: summary.totalRows,
        created: summary.created,
        linked: summary.linked,
        skipped: summary.skipped,
        errors: summary.errors,
        createdContactIds: summary.createdContactIds,
        createdIdentityIds: summary.createdIdentityIds,
        columnMap: summary.columnMap,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    if (idempotencyKey) {
      const body: ImportContactsCsvResult = {
        ...summary,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "contact.import_csv",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return { ...summary, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───────────────────────────────────────── vCard ingest

export type IngestVCardResult = {
  contact: Contact;
  identities: Identity[];
  contactCreated: boolean;
  addedIdentityIds: string[];
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function ingestVCard(
  ctx: CallerContext,
  input: VCardIngestInput,
  options: MutationOptions = {},
): Promise<IngestVCardResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<IngestVCardResult>(ctx, idempotencyKey, "contact.ingest_vcard");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const card = parseVCard(input.vcard);
  if (!card) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Could not parse vCard" });
  }
  const createIfMissing = input.createContactIfMissing ?? true;

  function normalizeIdy(i: ParsedVCardIdentity): { kind: string; value: string } {
    return { kind: i.kind, value: i.kind === "email" ? normalizeEmail(i.value) : i.value.trim() };
  }
  const wantedIdentities = card.identities.map(normalizeIdy).filter((i) => i.value);

  // Find an existing contact by ANY of the identities
  let existingContactId: string | null = null;
  if (wantedIdentities.length > 0) {
    for (const idy of wantedIdentities) {
      const hit = await db
        .select({ contactId: identities.contactId })
        .from(identities)
        .where(
          and(
            eq(identities.accountId, ctx.accountId),
            eq(identities.kind, idy.kind),
            eq(identities.value, idy.value),
          ),
        )
        .limit(1)
        .then((r) => r[0]);
      if (hit) {
        existingContactId = hit.contactId;
        break;
      }
    }
  }

  if (!existingContactId && !createIfMissing) {
    throw new ApiError({
      code: "NOT_FOUND",
      message: "No contact matches any identity in the vCard; pass createContactIfMissing:true to auto-create",
    });
  }

  const now = new Date().toISOString();
  const contactCreated = !existingContactId;
  let contact: Contact;
  if (existingContactId) {
    const row = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, existingContactId), eq(contacts.accountId, ctx.accountId)))
      .limit(1)
      .then((r) => r[0]);
    if (!row) {
      throw new ApiError({ code: "INTERNAL", message: "Linked contact row missing" });
    }
    contact = {
      id: row.id,
      accountId: row.accountId,
      name: row.name,
      primaryEmail: row.primaryEmail,
      primaryPhone: row.primaryPhone,
      status: row.status as Contact["status"],
      customFields: row.customFields ? (JSON.parse(row.customFields) as Record<string, unknown>) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } else {
    const cid = newId("contact");
    const firstEmail = wantedIdentities.find((i) => i.kind === "email")?.value ?? null;
    const firstPhone = wantedIdentities.find((i) => i.kind === "phone")?.value ?? null;
    contact = {
      id: cid,
      accountId: ctx.accountId,
      name: card.name,
      primaryEmail: firstEmail,
      primaryPhone: firstPhone,
      status: "lead",
      customFields:
        card.org || card.title
          ? { org: card.org ?? undefined, title: card.title ?? undefined }
          : null,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Determine which identities are NEW
  const existing = await db
    .select({ kind: identities.kind, value: identities.value })
    .from(identities)
    .where(eq(identities.contactId, contact.id));
  const existingKeys = new Set(existing.map((i) => `${i.kind}:${i.value}`));
  // Also avoid attaching same identity to a different contact (would conflict)
  const sameValueOtherContact = await db
    .select({ kind: identities.kind, value: identities.value, contactId: identities.contactId })
    .from(identities)
    .where(eq(identities.accountId, ctx.accountId));
  const valueOwner = new Map<string, string>();
  for (const r of sameValueOtherContact) valueOwner.set(`${r.kind}:${r.value}`, r.contactId);

  const toAttach: Identity[] = [];
  for (const idy of wantedIdentities) {
    const key = `${idy.kind}:${idy.value}`;
    if (existingKeys.has(key)) continue;
    const owner = valueOwner.get(key);
    if (owner && owner !== contact.id) continue; // belongs to another contact — skip silently
    toAttach.push({
      id: newId("identity"),
      accountId: ctx.accountId,
      contactId: contact.id,
      kind: idy.kind as Identity["kind"],
      value: idy.value,
      confidence: 100,
      createdAt: now,
    });
  }

  const allIdentitiesResult: Identity[] = [];
  // Existing ones we already loaded — re-query if we created the contact
  if (!contactCreated) {
    const rows = await db
      .select()
      .from(identities)
      .where(eq(identities.contactId, contact.id));
    for (const r of rows) {
      allIdentitiesResult.push({
        id: r.id,
        accountId: r.accountId,
        contactId: r.contactId,
        kind: r.kind as Identity["kind"],
        value: r.value,
        confidence: r.confidence,
        createdAt: r.createdAt,
      });
    }
  }
  for (const i of toAttach) allIdentitiesResult.push(i);

  if (dryRun) {
    return {
      contact,
      identities: allIdentitiesResult,
      contactCreated,
      addedIdentityIds: toAttach.map((i) => i.id),
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    if (contactCreated) {
      await tx.insert(contacts).values({
        id: contact.id,
        accountId: contact.accountId,
        name: contact.name,
        primaryEmail: contact.primaryEmail,
        primaryPhone: contact.primaryPhone,
        status: contact.status,
        customFields: contact.customFields ? JSON.stringify(contact.customFields) : null,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      });
    }
    for (const i of toAttach) {
      await tx.insert(identities).values(i);
    }

    const actionOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "contact.ingest_vcard",
      targetKind: "contact",
      targetId: contact.id,
      metadata: {
        contactId: contact.id,
        contactCreated,
        addedIdentityIds: toAttach.map((i) => i.id),
        parsedName: card.name,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    if (idempotencyKey) {
      const body: IngestVCardResult = {
        contact,
        identities: allIdentitiesResult,
        contactCreated,
        addedIdentityIds: toAttach.map((i) => i.id),
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "contact.ingest_vcard",
          responseStatus: contactCreated ? 201 : 200,
          responseBody: body,
        }),
      );
    }
  });

  return {
    contact,
    identities: allIdentitiesResult,
    contactCreated,
    addedIdentityIds: toAttach.map((i) => i.id),
    agentActionId: actionId,
    dryRun: false,
    replayed: false,
  };
}

// ───────────────────────────────────────── account export

export type AccountExport = {
  exportedAt: string;
  schemaVersion: "1";
  filters: { since: string | null };
  account: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    updatedAt: string;
  };
  apiKeys: Array<{
    id: string;
    label: string;
    tokenPreview: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
  contacts: unknown[];
  identities: unknown[];
  interactions: unknown[];
  deals: unknown[];
  tasks: unknown[];
  notes: unknown[];
  tags: unknown[];
  contactTags: unknown[];
  actions: unknown[] | null;
};

export async function exportAccount(
  ctx: CallerContext,
  filters: ExportAccountFilters,
): Promise<AccountExport> {
  const since = filters.since ?? null;
  const includeActions = filters.includeActions ?? true;

  const acc = await db.select().from(accounts).where(eq(accounts.id, ctx.accountId)).limit(1).then((r) => r[0]);
  if (!acc) throw new ApiError({ code: "NOT_FOUND", message: "Account not found" });

  const keys = await db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      tokenPreview: apiKeys.tokenPreview,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.accountId, ctx.accountId));

  const sinceCond = (col: ReturnType<typeof eq>) => (since ? and(col, gte(contacts.updatedAt, since)) : col);

  // Per-table since filter on the most relevant timestamp
  const contactsRows = await db
    .select()
    .from(contacts)
    .where(since ? and(eq(contacts.accountId, ctx.accountId), gte(contacts.updatedAt, since)) : eq(contacts.accountId, ctx.accountId));
  const identitiesRows = await db
    .select()
    .from(identities)
    .where(since ? and(eq(identities.accountId, ctx.accountId), gte(identities.createdAt, since)) : eq(identities.accountId, ctx.accountId));
  const interactionsRows = await db
    .select()
    .from(interactions)
    .where(since ? and(eq(interactions.accountId, ctx.accountId), gte(interactions.occurredAt, since)) : eq(interactions.accountId, ctx.accountId));
  const dealsRows = await db
    .select()
    .from(deals)
    .where(since ? and(eq(deals.accountId, ctx.accountId), gte(deals.updatedAt, since)) : eq(deals.accountId, ctx.accountId));
  const tasksRows = await db
    .select()
    .from(tasks)
    .where(since ? and(eq(tasks.accountId, ctx.accountId), gte(tasks.updatedAt, since)) : eq(tasks.accountId, ctx.accountId));
  const notesRows = await db
    .select()
    .from(notes)
    .where(since ? and(eq(notes.accountId, ctx.accountId), gte(notes.updatedAt, since)) : eq(notes.accountId, ctx.accountId));
  const tagsRows = await db
    .select()
    .from(tags)
    .where(since ? and(eq(tags.accountId, ctx.accountId), gte(tags.createdAt, since)) : eq(tags.accountId, ctx.accountId));

  // contactTags has no createdAt-since column reasonably; export all linked to in-account contacts
  const tagIds = tagsRows.map((t) => t.id);
  const contactTagRows = tagIds.length === 0
    ? []
    : await db
        .select()
        .from(contactTags)
        .where(inArray(contactTags.tagId, tagIds));

  const actionsRows = includeActions
    ? await db
        .select()
        .from(agentActions)
        .where(
          since
            ? and(eq(agentActions.accountId, ctx.accountId), gte(agentActions.createdAt, since))
            : eq(agentActions.accountId, ctx.accountId),
        )
    : null;

  // Suppress unused helper warning
  void sinceCond;

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: "1",
    filters: { since },
    account: {
      id: acc.id,
      email: acc.email,
      name: acc.name,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    },
    apiKeys: keys,
    contacts: contactsRows,
    identities: identitiesRows,
    interactions: interactionsRows.map((r) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    })),
    deals: dealsRows.map((r) => ({ ...r, customFields: r.customFields ? JSON.parse(r.customFields) : null })),
    tasks: tasksRows,
    notes: notesRows,
    tags: tagsRows,
    contactTags: contactTagRows,
    actions: actionsRows
      ? actionsRows.map((r) => ({
          ...r,
          metadata: r.metadata ? JSON.parse(r.metadata) : null,
        }))
      : null,
  };
}

// ───────────────────────────────────────── contacts CSV export

export async function exportContactsCsv(
  ctx: CallerContext,
  filters: { status?: string; since?: string },
): Promise<string> {
  const conds = [eq(contacts.accountId, ctx.accountId)];
  if (filters.status) conds.push(eq(contacts.status, filters.status));
  if (filters.since) conds.push(gte(contacts.updatedAt, filters.since));

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conds))
    .orderBy(asc(contacts.createdAt));

  const allIds = await db
    .select()
    .from(identities)
    .where(eq(identities.accountId, ctx.accountId));
  const byContact = new Map<string, string[]>();
  for (const i of allIds) {
    const list = byContact.get(i.contactId) ?? [];
    list.push(`${i.kind}=${i.value}`);
    byContact.set(i.contactId, list);
  }

  const header = [
    "id",
    "name",
    "primary_email",
    "primary_phone",
    "status",
    "created_at",
    "updated_at",
    "identities",
  ];
  const dataRows = rows.map((r) => [
    r.id,
    r.name,
    r.primaryEmail ?? "",
    r.primaryPhone ?? "",
    r.status,
    r.createdAt,
    r.updatedAt,
    (byContact.get(r.id) ?? []).join("; "),
  ]);
  return stringifyCsv([header, ...dataRows]);
}
