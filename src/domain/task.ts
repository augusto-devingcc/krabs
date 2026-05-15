import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { db } from "@/db/client.js";
import { agentActions, contacts, deals, tasks, type TaskRow } from "@/db/schema.js";
import { newId } from "@/contract/ids.js";
import { ApiError } from "@/contract/errors.js";
import type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListFilters,
} from "@/contract/schemas/task.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    accountId: row.accountId,
    contactId: row.contactId,
    dealId: row.dealId,
    title: row.title,
    description: row.description,
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    dueAt: row.dueAt,
    completedAt: row.completedAt,
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

export type CreateTaskResult = {
  task: Task;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createTask(
  ctx: CallerContext,
  input: TaskCreateInput,
  options: MutationOptions = {},
): Promise<CreateTaskResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateTaskResult>(ctx, idempotencyKey, "task.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }
  if (input.contactId) await requireContactExists(ctx, input.contactId);
  if (input.dealId) await requireDealExists(ctx, input.dealId);

  const now = new Date().toISOString();
  const id = newId("task");
  const status = input.status ?? "open";
  const planned: Task = {
    id,
    accountId: ctx.accountId,
    contactId: input.contactId ?? null,
    dealId: input.dealId ?? null,
    title: input.title,
    description: input.description ?? null,
    status,
    priority: input.priority ?? "normal",
    dueAt: input.dueAt ?? null,
    completedAt: status === "done" ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  if (dryRun) return { task: planned, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id: planned.id,
      accountId: planned.accountId,
      contactId: planned.contactId,
      dealId: planned.dealId,
      title: planned.title,
      description: planned.description,
      status: planned.status,
      priority: planned.priority,
      dueAt: planned.dueAt,
      completedAt: planned.completedAt,
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
      operation: "task.create",
      targetKind: "task",
      targetId: id,
      metadata: { title: input.title, status: planned.status, dueAt: planned.dueAt },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: CreateTaskResult = { task: planned, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "task.create", responseStatus: 201, responseBody: body }),
      );
    }
  });
  return { task: planned, agentActionId: actionId, dryRun: false, replayed: false };
}

export async function getTask(ctx: CallerContext, id: string): Promise<Task> {
  const row = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: `Task ${id} not found` });
  return rowToTask(row);
}

export type ListTasksResult = { items: Task[]; nextCursor: string | null };

export async function listTasks(ctx: CallerContext, filters: TaskListFilters): Promise<ListTasksResult> {
  const limit = filters.limit ?? 50;
  const conds = [eq(tasks.accountId, ctx.accountId)];
  if (filters.contactId) conds.push(eq(tasks.contactId, filters.contactId));
  if (filters.dealId) conds.push(eq(tasks.dealId, filters.dealId));
  if (filters.status) conds.push(eq(tasks.status, filters.status));
  if (filters.priority) conds.push(eq(tasks.priority, filters.priority));
  if (filters.dueBefore) conds.push(lte(tasks.dueAt, filters.dueBefore));
  if (filters.cursor) conds.push(gt(tasks.id, filters.cursor));
  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conds))
    .orderBy(asc(tasks.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: trimmed.map(rowToTask),
    nextCursor: hasMore ? (trimmed.at(-1)?.id ?? null) : null,
  };
}

export type UpdateTaskResult = {
  task: Task;
  before: Task;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateTask(
  ctx: CallerContext,
  id: string,
  patch: TaskUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateTaskResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateTaskResult>(ctx, idempotencyKey, "task.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Task ${id} not found` });
  const before = rowToTask(existing);
  const now = new Date().toISOString();

  if (patch.contactId !== undefined && patch.contactId !== null) await requireContactExists(ctx, patch.contactId);
  if (patch.dealId !== undefined && patch.dealId !== null) await requireDealExists(ctx, patch.dealId);

  const nextStatus = patch.status ?? before.status;
  // Auto-manage completedAt: set on transition to done, clear on transition away
  let completedAt: string | null = before.completedAt;
  if (patch.status !== undefined && patch.status !== before.status) {
    if (patch.status === "done") completedAt = now;
    else completedAt = null;
  }

  const next: Task = {
    ...before,
    title: patch.title ?? before.title,
    description: patch.description === undefined ? before.description : patch.description,
    contactId: patch.contactId === undefined ? before.contactId : patch.contactId,
    dealId: patch.dealId === undefined ? before.dealId : patch.dealId,
    status: nextStatus,
    priority: patch.priority ?? before.priority,
    dueAt: patch.dueAt === undefined ? before.dueAt : patch.dueAt,
    completedAt,
    updatedAt: now,
  };

  if (dryRun) return { task: next, before, agentActionId: null, dryRun: true, replayed: false };

  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        title: next.title,
        description: next.description,
        contactId: next.contactId,
        dealId: next.dealId,
        status: next.status,
        priority: next.priority,
        dueAt: next.dueAt,
        completedAt: next.completedAt,
        updatedAt: now,
      })
      .where(eq(tasks.id, id));
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
      operation: "task.update",
      targetKind: "task",
      targetId: id,
      metadata: { before, patch },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    if (idempotencyKey) {
      const body: UpdateTaskResult = { task: next, before, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "task.update", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { task: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}

export type DeleteTaskResult = {
  deletedId: string;
  snapshot: Task;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function deleteTask(
  ctx: CallerContext,
  id: string,
  options: MutationOptions = {},
): Promise<DeleteTaskResult> {
  const { idempotencyKey, intent, dryRun = false } = options;
  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<DeleteTaskResult>(ctx, idempotencyKey, "task.delete");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) throw new ApiError({ code: "NOT_FOUND", message: `Task ${id} not found` });
  const snapshot = rowToTask(existing);
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
      operation: "task.delete",
      targetKind: "task",
      targetId: id,
      metadata: { snapshot },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });
    await tx.delete(tasks).where(eq(tasks.id, id));
    if (idempotencyKey) {
      const body: DeleteTaskResult = { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({ ctx, key: idempotencyKey, operation: "task.delete", responseStatus: 200, responseBody: body }),
      );
    }
  });
  return { deletedId: id, snapshot, agentActionId: actionId, dryRun: false, replayed: false };
}
