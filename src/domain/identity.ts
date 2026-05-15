import { and, eq } from "drizzle-orm";
import { db } from "@/db/client.js";
import { contacts, identities, type ContactRow, type IdentityRow } from "@/db/schema.js";
import { newId } from "@/contract/ids.js";
import { ApiError } from "@/contract/errors.js";
import type { Identity, IdentityAddInput } from "@/contract/schemas/identity.js";
import type { Contact } from "@/contract/schemas/contact.js";
import {
  agentActions,
  idempotencyKeys,
  lookupIdempotent,
  buildAction,
  buildIdempotencyRecord,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

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

function rowToContact(row: ContactRow): Contact {
  return {
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
}

function normalizeValue(kind: string, value: string): string {
  if (kind === "email") return value.trim().toLowerCase();
  return value.trim();
}

// ───────────────────────────────────────── add

export type AddIdentityResult = {
  identity: Identity;
  contact: Contact;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function addIdentity(
  ctx: CallerContext,
  input: IdentityAddInput,
  options: MutationOptions = {},
): Promise<AddIdentityResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<AddIdentityResult>(ctx, idempotencyKey, "identity.add");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const value = normalizeValue(input.kind, input.value);

  const contactRow = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, input.contactId), eq(contacts.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!contactRow) {
    throw new ApiError({ code: "NOT_FOUND", message: `Contact ${input.contactId} not found` });
  }

  const conflict = await db
    .select({ id: identities.id, contactId: identities.contactId })
    .from(identities)
    .where(
      and(
        eq(identities.accountId, ctx.accountId),
        eq(identities.kind, input.kind),
        eq(identities.value, value),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (conflict) {
    if (conflict.contactId === input.contactId) {
      throw new ApiError({
        code: "CONFLICT",
        message: "This identity is already attached to this contact",
      });
    }
    throw new ApiError({
      code: "CONFLICT",
      message: `This ${input.kind} is already attached to a different contact`,
      hint: `Use contact.merge to combine ${conflict.contactId} into ${input.contactId} (or vice versa)`,
    });
  }

  const now = new Date().toISOString();
  const identityId = newId("identity");
  const planned: Identity = {
    id: identityId,
    accountId: ctx.accountId,
    contactId: input.contactId,
    kind: input.kind,
    value,
    confidence: input.confidence ?? 100,
    createdAt: now,
  };
  const contact = rowToContact(contactRow);

  if (dryRun) {
    return { identity: planned, contact, agentActionId: null, dryRun: true, replayed: false };
  }

  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    await tx.insert(identities).values(planned);

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
      operation: "identity.add",
      targetKind: "identity",
      targetId: identityId,
      metadata: { contactId: input.contactId, kind: input.kind, value },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    if (idempotencyKey) {
      const body: AddIdentityResult = {
        identity: planned,
        contact,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "identity.add",
          responseStatus: 201,
          responseBody: body,
        }),
      );
    }
  });

  return { identity: planned, contact, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───────────────────────────────────────── remove

export type RemoveIdentityResult = {
  removedIdentity: Identity;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function removeIdentity(
  ctx: CallerContext,
  identityId: string,
  options: MutationOptions = {},
): Promise<RemoveIdentityResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<RemoveIdentityResult>(ctx, idempotencyKey, "identity.remove");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const row = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) {
    throw new ApiError({ code: "NOT_FOUND", message: `Identity ${identityId} not found` });
  }

  const removed = rowToIdentity(row);

  if (dryRun) {
    return { removedIdentity: removed, agentActionId: null, dryRun: true, replayed: false };
  }

  const now = new Date().toISOString();
  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
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
      operation: "identity.remove",
      targetKind: "identity",
      targetId: identityId,
      metadata: { snapshot: removed },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    await tx.delete(identities).where(eq(identities.id, identityId));

    if (idempotencyKey) {
      const body: RemoveIdentityResult = {
        removedIdentity: removed,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "identity.remove",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return { removedIdentity: removed, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───────────────────────────────────────── list

export type ListIdentitiesOptions = {
  contactId?: string;
  kind?: string;
};

export async function listIdentities(
  ctx: CallerContext,
  options: ListIdentitiesOptions = {},
): Promise<{ items: Identity[] }> {
  const conds = [eq(identities.accountId, ctx.accountId)];
  if (options.contactId) conds.push(eq(identities.contactId, options.contactId));
  if (options.kind) conds.push(eq(identities.kind, options.kind));
  const rows = await db
    .select()
    .from(identities)
    .where(and(...conds));
  return { items: rows.map(rowToIdentity) };
}

// ───────────────────────────────────────── find contact by identity

export type FindContactByIdentityResult = {
  contact: Contact;
  identity: Identity;
} | null;

export async function findContactByIdentity(
  ctx: CallerContext,
  kind: string,
  value: string,
): Promise<FindContactByIdentityResult> {
  const normalized = normalizeValue(kind, value);
  const idRow = await db
    .select()
    .from(identities)
    .where(
      and(
        eq(identities.accountId, ctx.accountId),
        eq(identities.kind, kind),
        eq(identities.value, normalized),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!idRow) return null;

  const contactRow = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, idRow.contactId))
    .limit(1)
    .then((r) => r[0]);
  if (!contactRow) return null;

  return { contact: rowToContact(contactRow), identity: rowToIdentity(idRow) };
}

export { normalizeValue };
