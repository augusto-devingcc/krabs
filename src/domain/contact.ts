import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client.js";
import {
  contacts,
  identities,
  agentActions,
  idempotencyKeys,
  type ContactRow,
  type IdentityRow,
} from "@/db/schema.js";
import { newId } from "@/contract/ids.js";
import { ApiError } from "@/contract/errors.js";
import type { Contact, ContactCreateInput } from "@/contract/schemas/contact.js";
import type { Identity } from "@/contract/schemas/identity.js";

export type CallerContext = {
  accountId: string;
  apiKeyId: string;
};

export type CreateContactOptions = {
  idempotencyKey?: string;
  intent?: string;
  dryRun?: boolean;
};

export type CreateContactResult = {
  contact: Contact;
  identities: Identity[];
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

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

export async function createContact(
  ctx: CallerContext,
  input: ContactCreateInput,
  options: CreateContactOptions = {},
): Promise<CreateContactResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  // Idempotency: only applies to real mutations, not dry-runs.
  if (idempotencyKey && !dryRun) {
    const cached = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.accountId, ctx.accountId), eq(idempotencyKeys.key, idempotencyKey)))
      .limit(1)
      .then((r) => r[0]);

    if (cached) {
      if (cached.operation !== "contact.create") {
        throw new ApiError({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency key reused for a different operation",
          hint: `Original operation was '${cached.operation}'`,
        });
      }
      const body = JSON.parse(cached.responseBody) as CreateContactResult;
      return { ...body, replayed: true };
    }
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

  const agentActionId = newId("agentAction");

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
        await tx.insert(identities).values({
          id: id.id,
          accountId: id.accountId,
          contactId: id.contactId,
          kind: id.kind,
          value: id.value,
          confidence: id.confidence,
          createdAt: id.createdAt,
        });
      }

      await tx.insert(agentActions).values({
        id: agentActionId,
        accountId: ctx.accountId,
        apiKeyId: ctx.apiKeyId,
        operation: "contact.create",
        targetKind: "contact",
        targetId: contactId,
        intent: intent ?? null,
        createdAt: now,
      });

      if (idempotencyKey) {
        const result: CreateContactResult = {
          contact: plannedContact,
          identities: plannedIdentities,
          agentActionId,
          dryRun: false,
          replayed: false,
        };
        await tx.insert(idempotencyKeys).values({
          id: newId("idempotencyKey"),
          accountId: ctx.accountId,
          apiKeyId: ctx.apiKeyId,
          key: idempotencyKey,
          operation: "contact.create",
          responseStatus: 201,
          responseBody: JSON.stringify(result),
        });
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed: identities")) {
      throw new ApiError({
        code: "CONFLICT",
        message: "An identity with this kind+value already exists in this account",
        hint: "Use contact.merge or a different value",
      });
    }
    throw err;
  }

  return {
    contact: plannedContact,
    identities: plannedIdentities,
    agentActionId,
    dryRun: false,
    replayed: false,
  };
}

export async function getContact(ctx: CallerContext, contactId: string): Promise<{
  contact: Contact;
  identities: Identity[];
}> {
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
    createdAt: r.createdAt,
  }));
}
