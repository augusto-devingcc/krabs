import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db/client.js";
import { agentActions, contacts, contactTags, tags, type TagRow } from "@/db/schema.js";
import { newId } from "@/contract/ids.js";
import { ApiError } from "@/contract/errors.js";
import type { Tag, TagCreateInput, TagUpdateInput } from "@/contract/schemas/tag.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  };
}

async function requireContactExists(ctx: CallerContext, contactId: string) {
  const r = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!r) throw new ApiError({ code: "NOT_FOUND", message: `Contact ${contactId} not found` });
}

async function requireTagExists(ctx: CallerContext, tagId: string) {
  const r = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!r) throw new ApiError({ code: "NOT_FOUND", message: `Tag ${tagId} not found` });
}

// ───── create

export type CreateTagResult = {
  tag: Tag;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createTag(
  ctx: CallerContext,
  input: TagCreateInput,
  options: MutationOptions = {},
): Promise<CreateTagResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateTagResult>(ctx, idempotencyKey, "tag.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  const now = new Date().toISOString();
  const id = newId("tag");
  const planned: Tag = {
    id,
    accountId: ctx.accountId,
    name: input.name,
    color: input.color ?? null,
    createdAt: now,
  };

  if (dryRun) return { tag: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tags).values(planned);
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
        operation: "tag.create",
        targetKind: "tag",
        targetId: id,
        metadata: { name: input.name },
        createdAt: now,
      };
      if (intent) actionOpts.intent = intent;
      await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
      if (idempotencyKey) {
        const body: CreateTagResult = { tag: planned, agentActionId: actionId, dryRun: false, replayed: false };
        await tx.insert(idempotencyKeys).values(
          buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "tag.create", responseStatus: 201, responseBody: body }),
        );
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed: tags")) {
      throw new ApiError({ code: "CONFLICT", message: `A tag named '${input.name}' already exists`, field: "name" });
    }
    throw err;
  }
  return { tag: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function getTag(ctx: CallerContext, id: string): Promise<Tag> {
  const row = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Tag ${id} not found` });
  return rowToTag(row);
}

export async function listTags(ctx: CallerContext): Promise<{ items: Tag[] }> {
  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.accountId, ctx.accountId))
    .orderBy(asc(tags.name));
  return { items: rows.map(rowToTag) };
}

export type UpdateTagResult = {
  tag: Tag;
  before: Tag;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateTag(
  ctx: CallerContext,
  id: string,
  patch: TagUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateTagResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateTagResult>(ctx, idempotencyKey, "tag.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Tag ${id} not found` });
  const before = rowToTag(existing);
  const next: Tag = {
    ...before,
    name: patch.name ?? before.name,
    color: patch.color === undefined ? before.color : patch.color,
  };

  if (dryRun) return { tag: next, before, agentActionId: null, dryRun: true, replayed: false };

  const now = new Date().toISOString();
  const actionId = newId("agentAction");
  try {
    await db.transaction(async (tx) => {
      await tx.update(tags).set({ name: next.name, color: next.color }).where(eq(tags.id, id));
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
        operation: "tag.update",
        targetKind: "tag",
        targetId: id,
        metadata: { before, patch },
        createdAt: now,
      };
      if (intent) actionOpts.intent = intent;
      await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
      if (idempotencyKey) {
        const body: UpdateTagResult = { tag: next, before, agentActionId: actionId, dryRun: false, replayed: false };
        await tx.insert(idempotencyKeys).values(
          buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "tag.update", responseStatus: 200, responseBody: body }),
        );
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed: tags")) {
      throw new ApiError({ code: "CONFLICT", message: `Another tag already has name '${next.name}'`, field: "name" });
    }
    throw err;
  }
  return { tag: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type DeleteTagResult = {
  deletedId: string;
  snapshot: { tag: Tag; contactIds: string[] };
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function deleteTag(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<DeleteTagResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DeleteTagResult>(ctx, idempotencyKey, "tag.delete");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Tag ${id} not found` });

  const linkedRows = await db
    .select({ contactId: contactTags.contactId })
    .from(contactTags)
    .where(eq(contactTags.tagId, id));
  const snapshot = {
    tag: rowToTag(existing),
    contactIds: linkedRows.map((r) => r.contactId),
  };

  if (dryRun) return { deletedId: id, snapshot, agentActionId: null, dryRun: true, replayed: false };

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
      operation: "tag.delete",
      targetKind: "tag",
      targetId: id,
      metadata: { snapshot },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    await tx.delete(tags).where(eq(tags.id, id));
    if (idempotencyKey) {
      const body: DeleteTagResult = { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "tag.delete", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
}

// ───── attach / detach

export type AttachTagResult = {
  contactId: string;
  tagId: string;
  alreadyAttached: boolean;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function attachTag(
  ctx: CallerContext,
  args: { contactId: string; tagId: string },
  options: MutationOptions = {},
): Promise<AttachTagResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<AttachTagResult>(ctx, idempotencyKey, "tag.attach");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  await requireContactExists(ctx, args.contactId);
  await requireTagExists(ctx, args.tagId);

  const existing = await db
    .select()
    .from(contactTags)
    .where(and(eq(contactTags.contactId, args.contactId), eq(contactTags.tagId, args.tagId)))
    .limit(1)
    .then((r) => r[0]);

  if (existing) {
    return {
      contactId: args.contactId,
      tagId: args.tagId,
      alreadyAttached: true,
      agentActionId: null,
      dryRun,
      replayed: false,
    };
  }

  if (dryRun) {
    return {
      contactId: args.contactId,
      tagId: args.tagId,
      alreadyAttached: false,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const now = new Date().toISOString();
  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    await tx.insert(contactTags).values({ contactId: args.contactId, tagId: args.tagId, createdAt: now });
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
      operation: "tag.attach",
      targetKind: "contact_tag",
      targetId: `${args.contactId}:${args.tagId}`,
      metadata: { contactId: args.contactId, tagId: args.tagId },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: AttachTagResult = {
        contactId: args.contactId,
        tagId: args.tagId,
        alreadyAttached: false,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "tag.attach", responseStatus: 201, responseBody: body }),
      );
    }
  });

  return {
    contactId: args.contactId,
    tagId: args.tagId,
    alreadyAttached: false,
    agentActionId: actionId,
    dryRun: false,
    replayed: false,
  };
}

export type DetachTagResult = {
  contactId: string;
  tagId: string;
  wasAttached: boolean;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function detachTag(
  ctx: CallerContext,
  args: { contactId: string; tagId: string },
  options: MutationOptions = {},
): Promise<DetachTagResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DetachTagResult>(ctx, idempotencyKey, "tag.detach");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  await requireContactExists(ctx, args.contactId);
  await requireTagExists(ctx, args.tagId);

  const existing = await db
    .select()
    .from(contactTags)
    .where(and(eq(contactTags.contactId, args.contactId), eq(contactTags.tagId, args.tagId)))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    return {
      contactId: args.contactId,
      tagId: args.tagId,
      wasAttached: false,
      agentActionId: null,
      dryRun,
      replayed: false,
    };
  }

  if (dryRun) {
    return {
      contactId: args.contactId,
      tagId: args.tagId,
      wasAttached: true,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
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
      operation: "tag.detach",
      targetKind: "contact_tag",
      targetId: `${args.contactId}:${args.tagId}`,
      metadata: { contactId: args.contactId, tagId: args.tagId, createdAt: existing.createdAt },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    await tx
      .delete(contactTags)
      .where(and(eq(contactTags.contactId, args.contactId), eq(contactTags.tagId, args.tagId)));
    if (idempotencyKey) {
      const body: DetachTagResult = {
        contactId: args.contactId,
        tagId: args.tagId,
        wasAttached: true,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "tag.detach", responseStatus: 200, responseBody: body }),
      );
    }
  });

  return {
    contactId: args.contactId,
    tagId: args.tagId,
    wasAttached: true,
    agentActionId: actionId,
    dryRun: false,
    replayed: false,
  };
}

export async function listTagsForContact(ctx: CallerContext, contactId: string): Promise<{ items: Tag[] }> {
  await requireContactExists(ctx, contactId);
  const rows = await db
    .select({
      id: tags.id,
      accountId: tags.accountId,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
    })
    .from(contactTags)
    .innerJoin(tags, eq(tags.id, contactTags.tagId))
    .where(eq(contactTags.contactId, contactId))
    .orderBy(asc(tags.name));
  return { items: rows.map(rowToTag) };
}
