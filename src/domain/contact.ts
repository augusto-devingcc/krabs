import { and, asc, desc, eq, gt, gte, inArray, like, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  contacts,
  identities,
  interactions,
  type ContactRow,
  type IdentityRow,
} from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { ApiError } from "../contract/errors.js";
import type {
  Contact,
  ContactCreateInput,
  ContactUpdateInput,
  ContactListFilters,
} from "../contract/schemas/contact.js";
import type { Identity } from "../contract/schemas/identity.js";
import {
  agentActions,
  idempotencyKeys,
  lookupIdempotent,
  buildAction,
  buildIdempotencyRecord,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export type { CallerContext };

function parseCustomFields(raw: string | null): Record<string, unknown> | null {
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    primaryEmail: row.primaryEmail,
    primaryPhone: row.primaryPhone,
    status: row.status as Contact["status"],
    customFields: parseCustomFields(row.customFields),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToIdentity(row: IdentityRow): Identity {
  return {
    id: row.id,
    accountId: row.accountId,
    contactId: row.contactId,
    kind: row.kind as Identity["kind"],
    value: row.value,
    confidence: row.confidence,
    createdAt: row.createdAt,
  };
}

function identityConflictFrom(err: unknown): ApiError | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("UNIQUE constraint failed: identities")) {
    return new ApiError({
      code: "CONFLICT",
      message: "An identity with this kind+value already exists in this account",
      hint: "Use contact.merge or a different value",
    });
  }
  return null;
}

// ───────────────────────────────────────── create

export type CreateContactResult = {
  contact: Contact;
  identities: Identity[];
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createContact(
  ctx: CallerContext,
  input: ContactCreateInput,
  options: MutationOptions = {},
): Promise<CreateContactResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateContactResult>(ctx, idempotencyKey, "contact.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const now = new Date().toISOString();
  const contactId = newId("contact");
  const customFieldsJson = input.customFields ? JSON.stringify(input.customFields) : null;

  const plannedContact: Contact = {
    id: contactId,
    accountId: ctx.accountId,
    name: input.name,
    primaryEmail: input.email ?? null,
    primaryPhone: input.phone ?? null,
    status: input.status,
    customFields: input.customFields ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const plannedIdentities: Identity[] = [];
  if (input.email) {
    plannedIdentities.push({
      id: newId("identity"),
      accountId: ctx.accountId,
      contactId,
      kind: "email",
      value: input.email.toLowerCase(),
      confidence: 100,
      createdAt: now,
    });
  }
  if (input.phone) {
    plannedIdentities.push({
      id: newId("identity"),
      accountId: ctx.accountId,
      contactId,
      kind: "phone",
      value: input.phone,
      confidence: 100,
      createdAt: now,
    });
  }

  if (dryRun) {
    return {
      contact: plannedContact,
      identities: plannedIdentities,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const actionId = newId("agentAction");

  try {
    await db.transaction(async (tx) => {
      await tx.insert(contacts).values({
        id: plannedContact.id,
        accountId: plannedContact.accountId,
        name: plannedContact.name,
        primaryEmail: plannedContact.primaryEmail,
        primaryPhone: plannedContact.primaryPhone,
        status: plannedContact.status,
        customFields: customFieldsJson,
        createdAt: plannedContact.createdAt,
        updatedAt: plannedContact.updatedAt,
      });

      for (const id of plannedIdentities) {
        await tx.insert(identities).values(id);
      }

      const actionOpts: {
        ctx: CallerContext;
        operation: string;
        targetKind: string;
        targetId: string;
        intent?: string;
        createdAt: string;
      } = {
        ctx,
        operation: "contact.create",
        targetKind: "contact",
        targetId: contactId,
        createdAt: now,
      };
      if (intent) actionOpts.intent = intent;
      await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

      if (idempotencyKey) {
        const body: CreateContactResult = {
          contact: plannedContact,
          identities: plannedIdentities,
          agentActionId: actionId,
          dryRun: false,
          replayed: false,
        };
        await tx.insert(idempotencyKeys).values(
          buildIdempotencyRecord({
            ctx,
            key: idempotencyKey,
            operation: "contact.create",
            responseStatus: 201,
            responseBody: body,
          }),
        );
      }
    });
  } catch (err) {
    const conflict = identityConflictFrom(err);
    if (conflict) throw conflict;
    throw err;
  }

  return {
    contact: plannedContact,
    identities: plannedIdentities,
    agentActionId: actionId,
    dryRun: false,
    replayed: false,
  };
}

// ───────────────────────────────────────── get

export async function getContact(
  ctx: CallerContext,
  contactId: string,
): Promise<{ contact: Contact; identities: Identity[] }> {
  const row = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    throw new ApiError({ code: "NOT_FOUND", message: `Contact ${contactId} not found` });
  }

  const idRows = await db
    .select()
    .from(identities)
    .where(eq(identities.contactId, contactId));

  return { contact: rowToContact(row), identities: idRows.map(rowToIdentity) };
}

// ───────────────────────────────────────── list

export type ListContactsResult = {
  items: Contact[];
  nextCursor: string | null;
};

export async function listContacts(
  ctx: CallerContext,
  filters: ContactListFilters,
): Promise<ListContactsResult> {
  const limit = filters.limit ?? 50;
  const conds = [eq(contacts.accountId, ctx.accountId)];
  if (filters.status) conds.push(eq(contacts.status, filters.status));
  if (filters.updatedSince) conds.push(gte(contacts.updatedAt, filters.updatedSince));
  if (filters.q) {
    const term = `%${filters.q.toLowerCase()}%`;
    conds.push(
      or(
        like(sql`lower(${contacts.name})`, term),
        like(sql`lower(${contacts.primaryEmail})`, term),
        like(sql`lower(${contacts.primaryPhone})`, term),
      )!,
    );
  }
  if (filters.cursor) conds.push(gt(contacts.id, filters.cursor));

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conds))
    .orderBy(asc(contacts.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (trimmed.at(-1)?.id ?? null) : null;

  return {
    items: trimmed.map(rowToContact),
    nextCursor,
  };
}

// ───────────────────────────────────────── update

export type UpdateContactResult = {
  contact: Contact;
  before: Contact;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateContact(
  ctx: CallerContext,
  contactId: string,
  patch: ContactUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateContactResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateContactResult>(ctx, idempotencyKey, "contact.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    throw new ApiError({ code: "NOT_FOUND", message: `Contact ${contactId} not found` });
  }

  const before = rowToContact(existing);
  const now = new Date().toISOString();

  const next: Contact = {
    ...before,
    name: patch.name ?? before.name,
    primaryEmail:
      patch.primaryEmail === undefined ? before.primaryEmail : patch.primaryEmail,
    primaryPhone:
      patch.primaryPhone === undefined ? before.primaryPhone : patch.primaryPhone,
    status: patch.status ?? before.status,
    customFields:
      patch.customFields === undefined ? before.customFields : patch.customFields,
    updatedAt: now,
  };

  if (dryRun) {
    return { contact: next, before, agentActionId: null, dryRun: true, replayed: false };
  }

  const actionId = newId("agentAction");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(contacts)
        .set({
          name: next.name,
          primaryEmail: next.primaryEmail,
          primaryPhone: next.primaryPhone,
          status: next.status,
          customFields: next.customFields ? JSON.stringify(next.customFields) : null,
          updatedAt: now,
        })
        .where(eq(contacts.id, contactId));

      // If primaryEmail changed to a new value, attach an Identity for the new email
      if (
        patch.primaryEmail !== undefined &&
        patch.primaryEmail &&
        patch.primaryEmail.toLowerCase() !== (before.primaryEmail?.toLowerCase() ?? "")
      ) {
        await tx.insert(identities).values({
          id: newId("identity"),
          accountId: ctx.accountId,
          contactId,
          kind: "email",
          value: patch.primaryEmail.toLowerCase(),
          confidence: 100,
          createdAt: now,
        });
      }
      if (
        patch.primaryPhone !== undefined &&
        patch.primaryPhone &&
        patch.primaryPhone !== before.primaryPhone
      ) {
        await tx.insert(identities).values({
          id: newId("identity"),
          accountId: ctx.accountId,
          contactId,
          kind: "phone",
          value: patch.primaryPhone,
          confidence: 100,
          createdAt: now,
        });
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
        operation: "contact.update",
        targetKind: "contact",
        targetId: contactId,
        metadata: { before, patch },
        createdAt: now,
      };
      if (intent) actionOpts.intent = intent;
      await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

      if (idempotencyKey) {
        const body: UpdateContactResult = {
          contact: next,
          before,
          agentActionId: actionId,
          dryRun: false,
          replayed: false,
        };
        await tx.insert(idempotencyKeys).values(
          buildIdempotencyRecord({
            ctx,
            key: idempotencyKey,
            operation: "contact.update",
            responseStatus: 200,
            responseBody: body,
          }),
        );
      }
    });
  } catch (err) {
    const conflict = identityConflictFrom(err);
    if (conflict) throw conflict;
    throw err;
  }

  return { contact: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───────────────────────────────────────── delete

export type DeleteContactResult = {
  deletedId: string;
  snapshot: {
    contact: Contact;
    identities: Identity[];
    interactionIds: string[];
  };
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function deleteContact(
  ctx: CallerContext,
  contactId: string,
  options: MutationOptions = {},
): Promise<DeleteContactResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DeleteContactResult>(ctx, idempotencyKey, "contact.delete");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    throw new ApiError({ code: "NOT_FOUND", message: `Contact ${contactId} not found` });
  }

  const idRows = await db.select().from(identities).where(eq(identities.contactId, contactId));
  const interactionRows = await db
    .select({ id: interactions.id })
    .from(interactions)
    .where(eq(interactions.contactId, contactId));
  const snapshot = {
    contact: rowToContact(existing),
    identities: idRows.map(rowToIdentity),
    interactionIds: interactionRows.map((r) => r.id),
  };

  if (dryRun) {
    return {
      deletedId: contactId,
      snapshot,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const now = new Date().toISOString();
  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    // Record action FIRST so the audit trail survives even though identities cascade-delete
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
      operation: "contact.delete",
      targetKind: "contact",
      targetId: contactId,
      metadata: { snapshot },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    // Cascade handles identities; explicit delete for clarity
    await tx.delete(contacts).where(eq(contacts.id, contactId));

    if (idempotencyKey) {
      const body: DeleteContactResult = {
        deletedId: contactId,
        snapshot,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "contact.delete",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return { deletedId: contactId, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───────────────────────────────────────── merge

export type MergeContactsResult = {
  kept: Contact;
  mergedFrom: Contact;
  migratedIdentities: Identity[];
  skippedIdentities: Identity[];
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function mergeContacts(
  ctx: CallerContext,
  args: { keepId: string; mergeId: string },
  options: MutationOptions = {},
): Promise<MergeContactsResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (args.keepId === args.mergeId) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "keepId and mergeId must differ" });
  }

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<MergeContactsResult>(ctx, idempotencyKey, "contact.merge");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const [keepRow, mergeRow] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, args.keepId), eq(contacts.accountId, ctx.accountId)))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, args.mergeId), eq(contacts.accountId, ctx.accountId)))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!keepRow) {
    throw new ApiError({ code: "NOT_FOUND", message: `Contact ${args.keepId} not found` });
  }
  if (!mergeRow) {
    throw new ApiError({ code: "NOT_FOUND", message: `Contact ${args.mergeId} not found` });
  }

  const [keepIdsRows, mergeIdsRows] = await Promise.all([
    db.select().from(identities).where(eq(identities.contactId, args.keepId)),
    db.select().from(identities).where(eq(identities.contactId, args.mergeId)),
  ]);

  const keepIdentitySig = new Set(
    keepIdsRows.map((i) => `${i.kind}:${i.value}`),
  );
  const willMigrate: IdentityRow[] = [];
  const willSkip: IdentityRow[] = [];
  for (const id of mergeIdsRows) {
    if (keepIdentitySig.has(`${id.kind}:${id.value}`)) willSkip.push(id);
    else willMigrate.push(id);
  }

  const now = new Date().toISOString();
  const plannedKept: Contact = {
    ...rowToContact(keepRow),
    primaryEmail: keepRow.primaryEmail ?? mergeRow.primaryEmail,
    primaryPhone: keepRow.primaryPhone ?? mergeRow.primaryPhone,
    updatedAt: now,
  };

  const migrated = willMigrate.map(rowToIdentity);
  const skipped = willSkip.map(rowToIdentity);

  if (dryRun) {
    return {
      kept: plannedKept,
      mergedFrom: rowToContact(mergeRow),
      migratedIdentities: migrated,
      skippedIdentities: skipped,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    // Migrate non-conflicting identities
    for (const id of willMigrate) {
      await tx
        .update(identities)
        .set({ contactId: args.keepId })
        .where(eq(identities.id, id.id));
    }

    // Update kept contact metadata
    await tx
      .update(contacts)
      .set({
        primaryEmail: plannedKept.primaryEmail,
        primaryPhone: plannedKept.primaryPhone,
        updatedAt: now,
      })
      .where(eq(contacts.id, args.keepId));

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
      operation: "contact.merge",
      targetKind: "contact",
      targetId: args.keepId,
      metadata: {
        keptId: args.keepId,
        mergedFromId: args.mergeId,
        mergedFromSnapshot: rowToContact(mergeRow),
        migrated,
        skipped,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    // Cascade deletes any remaining (skipped/conflicting) identities tied to mergeId
    await tx.delete(contacts).where(eq(contacts.id, args.mergeId));

    if (idempotencyKey) {
      const body: MergeContactsResult = {
        kept: plannedKept,
        mergedFrom: rowToContact(mergeRow),
        migratedIdentities: migrated,
        skippedIdentities: skipped,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "contact.merge",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return {
    kept: plannedKept,
    mergedFrom: rowToContact(mergeRow),
    migratedIdentities: migrated,
    skippedIdentities: skipped,
    agentActionId: actionId,
    dryRun: false,
    replayed: false,
  };
}

// ───────────────────────────────────────── actions

export type ListActionsOptions = {
  limit?: number;
  apiKeyId?: string;
  targetKind?: string;
  targetId?: string;
};

export async function listActions(ctx: CallerContext, options: ListActionsOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const filters = [eq(agentActions.accountId, ctx.accountId)];
  if (options.apiKeyId) filters.push(eq(agentActions.apiKeyId, options.apiKeyId));
  if (options.targetKind) filters.push(eq(agentActions.targetKind, options.targetKind));
  if (options.targetId) filters.push(eq(agentActions.targetId, options.targetId));

  const rows = await db
    .select()
    .from(agentActions)
    .where(and(...filters))
    .orderBy(desc(agentActions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    apiKeyId: r.apiKeyId,
    operation: r.operation,
    targetKind: r.targetKind,
    targetId: r.targetId,
    intent: r.intent,
    metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null,
    createdAt: r.createdAt,
  }));
}
