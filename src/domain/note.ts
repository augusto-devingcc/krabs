import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { agentActions, contacts, deals, notes, type NoteRow } from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { ApiError } from "../contract/errors.js";
import type {
  Note,
  NoteCreateInput,
  NoteUpdateInput,
  NoteListFilters,
} from "../contract/schemas/note.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    accountId: row.accountId,
    contactId: row.contactId,
    dealId: row.dealId,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
async function requireDealExists(ctx: CallerContext, dealId: string) {
  const r = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!r) throw new ApiError({ code: "NOT_FOUND", message: `Deal ${dealId} not found` });
}

export type CreateNoteResult = {
  note: Note;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createNote(
  ctx: CallerContext,
  input: NoteCreateInput,
  options: MutationOptions = {},
): Promise<CreateNoteResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateNoteResult>(ctx, idempotencyKey, "note.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  if (input.contactId) await requireContactExists(ctx, input.contactId);
  if (input.dealId) await requireDealExists(ctx, input.dealId);

  const now = new Date().toISOString();
  const id = newId("note");
  const planned: Note = {
    id,
    accountId: ctx.accountId,
    contactId: input.contactId ?? null,
    dealId: input.dealId ?? null,
    title: input.title ?? null,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };

  if (dryRun) return { note: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.insert(notes).values({
      id: planned.id,
      accountId: planned.accountId,
      contactId: planned.contactId,
      dealId: planned.dealId,
      title: planned.title,
      body: planned.body,
      createdAt: planned.createdAt,
      updatedAt: planned.updatedAt,
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
      operation: "note.create",
      targetKind: "note",
      targetId: id,
      metadata: { title: planned.title, contactId: planned.contactId, dealId: planned.dealId },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: CreateNoteResult = { note: planned, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "note.create", responseStatus: 201, responseBody: body }),
      );
    }
  });
  return { note: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function getNote(ctx: CallerContext, id: string): Promise<Note> {
  const row = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Note ${id} not found` });
  return rowToNote(row);
}

export type ListNotesResult = { items: Note[]; nextCursor: string | null };

export async function listNotes(ctx: CallerContext, filters: NoteListFilters): Promise<ListNotesResult> {
  const limit = filters.limit ?? 50;
  const conds = [eq(notes.accountId, ctx.accountId)];
  if (filters.contactId) conds.push(eq(notes.contactId, filters.contactId));
  if (filters.dealId) conds.push(eq(notes.dealId, filters.dealId));
  if (filters.cursor) conds.push(gt(notes.id, filters.cursor));
  const rows = await db
    .select()
    .from(notes)
    .where(and(...conds))
    .orderBy(asc(notes.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: trimmed.map(rowToNote),
    nextCursor: hasMore ? (trimmed.at(-1)?.id ?? null) : null,
  };
}

export type UpdateNoteResult = {
  note: Note;
  before: Note;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateNote(
  ctx: CallerContext,
  id: string,
  patch: NoteUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateNoteResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateNoteResult>(ctx, idempotencyKey, "note.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Note ${id} not found` });
  const before = rowToNote(existing);
  const now = new Date().toISOString();

  if (patch.contactId !== undefined && patch.contactId !== null) await requireContactExists(ctx, patch.contactId);
  if (patch.dealId !== undefined && patch.dealId !== null) await requireDealExists(ctx, patch.dealId);

  const next: Note = {
    ...before,
    body: patch.body ?? before.body,
    title: patch.title === undefined ? before.title : patch.title,
    contactId: patch.contactId === undefined ? before.contactId : patch.contactId,
    dealId: patch.dealId === undefined ? before.dealId : patch.dealId,
    updatedAt: now,
  };

  if (dryRun) return { note: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(notes)
      .set({
        body: next.body,
        title: next.title,
        contactId: next.contactId,
        dealId: next.dealId,
        updatedAt: now,
      })
      .where(eq(notes.id, id));
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
      operation: "note.update",
      targetKind: "note",
      targetId: id,
      metadata: { before, patch },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: UpdateNoteResult = { note: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "note.update", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { note: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type DeleteNoteResult = {
  deletedId: string;
  snapshot: Note;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function deleteNote(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<DeleteNoteResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DeleteNoteResult>(ctx, idempotencyKey, "note.delete");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  const existing = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Note ${id} not found` });
  const snapshot = rowToNote(existing);
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
      operation: "note.delete",
      targetKind: "note",
      targetId: id,
      metadata: { snapshot },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    await tx.delete(notes).where(eq(notes.id, id));
    if (idempotencyKey) {
      const body: DeleteNoteResult = { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "note.delete", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
}
