import { and, asc, desc, eq, gt, gte, lte } from "drizzle-orm";
import { db } from "@/db/client.js";
import {
  contacts,
  identities,
  interactions,
  type InteractionRow,
  type ContactRow,
} from "@/db/schema.js";
import { ApiError } from "@/contract/errors.js";
import { newId } from "@/contract/ids.js";
import type {
  Interaction,
  InteractionCreateInput,
  InteractionListFilters,
  EmailIngestInput,
} from "@/contract/schemas/interaction.js";
import type { Contact } from "@/contract/schemas/contact.js";
import type { Identity } from "@/contract/schemas/identity.js";
import {
  agentActions,
  idempotencyKeys,
  lookupIdempotent,
  buildAction,
  buildIdempotencyRecord,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";
import { findContactByIdentity, normalizeValue } from "./identity.js";

function rowToInteraction(row: InteractionRow): Interaction {
  return {
    id: row.id,
    accountId: row.accountId,
    contactId: row.contactId,
    kind: row.kind as Interaction["kind"],
    direction: row.direction as Interaction["direction"],
    source: row.source,
    subject: row.subject,
    body: row.body,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    occurredAt: row.occurredAt,
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

// ───────────────────────────────────────── create

export type CreateInteractionResult = {
  interaction: Interaction;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createInteraction(
  ctx: CallerContext,
  input: InteractionCreateInput,
  options: MutationOptions = {},
): Promise<CreateInteractionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateInteractionResult>(ctx, idempotencyKey, "interaction.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  if (input.contactId) {
    const c = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, input.contactId), eq(contacts.accountId, ctx.accountId)))
      .limit(1)
      .then((r) => r[0]);
    if (!c) {
      throw new ApiError({ code: "NOT_FOUND", message: `Contact ${input.contactId} not found` });
    }
  }

  const now = new Date().toISOString();
  const id = newId("interaction");
  const occurredAt = input.occurredAt ?? now;
  const planned: Interaction = {
    id,
    accountId: ctx.accountId,
    contactId: input.contactId ?? null,
    kind: input.kind,
    direction: input.direction ?? null,
    source: input.source ?? null,
    subject: input.subject ?? null,
    body: input.body ?? null,
    metadata: input.metadata ?? null,
    occurredAt,
    createdAt: now,
  };

  if (dryRun) {
    return { interaction: planned, agentActionId: null, dryRun: true, replayed: false };
  }

  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    await tx.insert(interactions).values({
      id: planned.id,
      accountId: planned.accountId,
      contactId: planned.contactId,
      kind: planned.kind,
      direction: planned.direction,
      source: planned.source,
      subject: planned.subject,
      body: planned.body,
      metadata: planned.metadata ? JSON.stringify(planned.metadata) : null,
      occurredAt: planned.occurredAt,
      createdAt: planned.createdAt,
    });

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
      operation: "interaction.create",
      targetKind: "interaction",
      targetId: id,
      metadata: {
        kind: planned.kind,
        contactId: planned.contactId,
        subject: planned.subject,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    if (idempotencyKey) {
      const body: CreateInteractionResult = {
        interaction: planned,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "interaction.create",
          responseStatus: 201,
          responseBody: body,
        }),
      );
    }
  });

  return { interaction: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───────────────────────────────────────── list

export type ListInteractionsResult = {
  items: Interaction[];
  nextCursor: string | null;
};

export async function listInteractions(
  ctx: CallerContext,
  filters: InteractionListFilters,
): Promise<ListInteractionsResult> {
  const limit = filters.limit ?? 50;
  const conds = [eq(interactions.accountId, ctx.accountId)];
  if (filters.contactId) conds.push(eq(interactions.contactId, filters.contactId));
  if (filters.kind) conds.push(eq(interactions.kind, filters.kind));
  if (filters.since) conds.push(gte(interactions.occurredAt, filters.since));
  if (filters.cursor) conds.push(gt(interactions.id, filters.cursor));

  const rows = await db
    .select()
    .from(interactions)
    .where(and(...conds))
    .orderBy(desc(interactions.occurredAt), asc(interactions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: trimmed.map(rowToInteraction),
    nextCursor: hasMore ? (trimmed.at(-1)?.id ?? null) : null,
  };
}

// ───────────────────────────────────────── delete

export type DeleteInteractionResult = {
  deletedId: string;
  snapshot: Interaction;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function deleteInteraction(
  ctx: CallerContext,
  interactionId: string,
  options: MutationOptions = {},
): Promise<DeleteInteractionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DeleteInteractionResult>(ctx, idempotencyKey, "interaction.delete");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const row = await db
    .select()
    .from(interactions)
    .where(and(eq(interactions.id, interactionId), eq(interactions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) {
    throw new ApiError({ code: "NOT_FOUND", message: `Interaction ${interactionId} not found` });
  }

  const snapshot = rowToInteraction(row);

  if (dryRun) {
    return { deletedId: interactionId, snapshot, agentActionId: null, dryRun: true, replayed: false };
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
      operation: "interaction.delete",
      targetKind: "interaction",
      targetId: interactionId,
      metadata: { snapshot },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    await tx.delete(interactions).where(eq(interactions.id, interactionId));

    if (idempotencyKey) {
      const body: DeleteInteractionResult = {
        deletedId: interactionId,
        snapshot,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "interaction.delete",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return { deletedId: interactionId, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───────────────────────────────────────── email ingest

export type IngestEmailResult = {
  interaction: Interaction;
  contact: Contact;
  identity: Identity;
  contactCreated: boolean;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

/**
 * The showcase agentic op. Takes a pre-parsed email and:
 *   1. finds the contact by sender email identity (case-insensitive),
 *   2. creates the contact if missing (with a "found via email ingest" agent action),
 *   3. inserts an Interaction tied to the contact,
 *   4. records a single AgentAction for the ingest.
 */
export async function ingestEmail(
  ctx: CallerContext,
  input: EmailIngestInput,
  options: MutationOptions = {},
): Promise<IngestEmailResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<IngestEmailResult>(ctx, idempotencyKey, "interaction.ingest_email");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const senderEmail = normalizeValue("email", input.from.email);
  const senderName = input.from.name?.trim() || senderEmail;
  const occurredAt = input.receivedAt ?? new Date().toISOString();
  const createIfMissing = input.createContactIfMissing ?? true;

  // Lookup by identity
  let found = await findContactByIdentity(ctx, "email", senderEmail);

  let contactCreated = false;
  let contactForPlan: Contact;
  let identityForPlan: Identity;

  if (found) {
    contactForPlan = found.contact;
    identityForPlan = found.identity;
  } else if (createIfMissing) {
    contactCreated = true;
    const now = new Date().toISOString();
    contactForPlan = {
      id: newId("contact"),
      accountId: ctx.accountId,
      name: senderName,
      primaryEmail: senderEmail,
      primaryPhone: null,
      status: "lead",
      customFields: null,
      createdAt: now,
      updatedAt: now,
    };
    identityForPlan = {
      id: newId("identity"),
      accountId: ctx.accountId,
      contactId: contactForPlan.id,
      kind: "email",
      value: senderEmail,
      confidence: 100,
      createdAt: now,
    };
  } else {
    throw new ApiError({
      code: "NOT_FOUND",
      message: `No contact has email ${senderEmail}; pass createContactIfMissing:true to auto-create`,
    });
  }

  const interactionId = newId("interaction");
  const plannedInteraction: Interaction = {
    id: interactionId,
    accountId: ctx.accountId,
    contactId: contactForPlan.id,
    kind: "email_in",
    direction: input.direction ?? "inbound",
    source: input.source ?? "email_ingest",
    subject: input.subject ?? null,
    body: input.body ?? null,
    metadata: {
      from: { name: input.from.name, email: senderEmail },
      to: input.to ?? null,
      messageId: input.messageId ?? null,
    },
    occurredAt,
    createdAt: new Date().toISOString(),
  };

  if (dryRun) {
    return {
      interaction: plannedInteraction,
      contact: contactForPlan,
      identity: identityForPlan,
      contactCreated,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const ingestActionId = newId("agentAction");
  const createContactActionId = contactCreated ? newId("agentAction") : null;

  await db.transaction(async (tx) => {
    if (contactCreated) {
      await tx.insert(contacts).values({
        id: contactForPlan.id,
        accountId: contactForPlan.accountId,
        name: contactForPlan.name,
        primaryEmail: contactForPlan.primaryEmail,
        primaryPhone: contactForPlan.primaryPhone,
        status: contactForPlan.status,
        customFields: null,
        createdAt: contactForPlan.createdAt,
        updatedAt: contactForPlan.updatedAt,
      });
      await tx.insert(identities).values(identityForPlan);

      const createOpts: {
        ctx: CallerContext;
        operation: string;
        targetKind: string;
        targetId: string;
        intent?: string;
        metadata: Record<string, unknown>;
        createdAt: string;
      } = {
        ctx,
        operation: "contact.create",
        targetKind: "contact",
        targetId: contactForPlan.id,
        metadata: { via: "interaction.ingest_email", senderEmail },
        createdAt: contactForPlan.createdAt,
      };
      if (intent) createOpts.intent = intent;
      await tx
        .insert(agentActions)
        .values({ ...buildAction(createOpts), id: createContactActionId! });
    }

    await tx.insert(interactions).values({
      id: plannedInteraction.id,
      accountId: plannedInteraction.accountId,
      contactId: plannedInteraction.contactId,
      kind: plannedInteraction.kind,
      direction: plannedInteraction.direction,
      source: plannedInteraction.source,
      subject: plannedInteraction.subject,
      body: plannedInteraction.body,
      metadata: plannedInteraction.metadata
        ? JSON.stringify(plannedInteraction.metadata)
        : null,
      occurredAt: plannedInteraction.occurredAt,
      createdAt: plannedInteraction.createdAt,
    });

    const ingestOpts: {
      ctx: CallerContext;
      operation: string;
      targetKind: string;
      targetId: string;
      intent?: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    } = {
      ctx,
      operation: "interaction.ingest_email",
      targetKind: "interaction",
      targetId: interactionId,
      metadata: {
        senderEmail,
        contactId: contactForPlan.id,
        contactCreated,
        messageId: input.messageId ?? null,
      },
      createdAt: plannedInteraction.createdAt,
    };
    if (intent) ingestOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(ingestOpts), id: ingestActionId });

    if (idempotencyKey) {
      const body: IngestEmailResult = {
        interaction: plannedInteraction,
        contact: contactForPlan,
        identity: identityForPlan,
        contactCreated,
        agentActionId: ingestActionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "interaction.ingest_email",
          responseStatus: contactCreated ? 201 : 200,
          responseBody: body,
        }),
      );
    }
  });

  return {
    interaction: plannedInteraction,
    contact: contactForPlan,
    identity: identityForPlan,
    contactCreated,
    agentActionId: ingestActionId,
    dryRun: false,
    replayed: false,
  };
}
