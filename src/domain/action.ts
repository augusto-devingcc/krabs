import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { agentActions, apiKeys, accounts } from "../db/schema.js";
import { ApiError } from "../contract/errors.js";
import { newId } from "../contract/ids.js";
import {
  buildAction,
  buildIdempotencyRecord,
  lookupIdempotent,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export type AgentActionFull = {
  id: string;
  accountId: string;
  apiKeyId: string;
  operation: string;
  targetKind: string;
  targetId: string;
  intent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ListActionsOptions = {
  limit?: number;
  apiKeyId?: string;
  targetKind?: string;
  targetId?: string;
};

export async function listActions(
  ctx: CallerContext,
  options: ListActionsOptions = {},
): Promise<AgentActionFull[]> {
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

export type Reversibility = "reversible" | "one-way" | "read-only";

const REVERSIBILITY: Record<string, Reversibility> = {
  "account.update": "reversible",
  "api_key.create": "reversible",
  "api_key.revoke": "reversible",
};

export function reversibilityOf(operation: string): Reversibility {
  return REVERSIBILITY[operation] ?? "one-way";
}

export async function getAction(ctx: CallerContext, id: string): Promise<AgentActionFull> {
  const row = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.id, id), eq(agentActions.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) {
    throw new ApiError({ code: "NOT_FOUND", message: `Action ${id} not found` });
  }
  return {
    id: row.id,
    accountId: row.accountId,
    apiKeyId: row.apiKeyId,
    operation: row.operation,
    targetKind: row.targetKind,
    targetId: row.targetId,
    intent: row.intent,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    createdAt: row.createdAt,
  };
}

// ───────────────────────────────────────── undo

export type UndoActionResult = {
  undoneActionId: string;
  operation: string;
  reversal: Record<string, unknown>;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function undoAction(
  ctx: CallerContext,
  actionId: string,
  options: MutationOptions = {},
): Promise<UndoActionResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UndoActionResult>(ctx, idempotencyKey, "action.undo");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const action = await getAction(ctx, actionId);

  const reversibility = reversibilityOf(action.operation);
  if (reversibility !== "reversible") {
    const errArgs: { code: "CONFLICT"; message: string; hint?: string } = {
      code: "CONFLICT",
      message: `Action ${action.operation} is ${reversibility} and cannot be undone`,
    };
    if (reversibility === "one-way") errArgs.hint = "Re-execute the desired state manually.";
    throw new ApiError(errArgs);
  }

  const now = new Date().toISOString();
  const dispatcher = undoDispatchers[action.operation];
  if (!dispatcher) {
    throw new ApiError({
      code: "CONFLICT",
      message: `No undo handler registered for ${action.operation}`,
    });
  }

  if (dryRun) {
    const plan = await dispatcher.plan(ctx, action);
    return {
      undoneActionId: actionId,
      operation: action.operation,
      reversal: plan,
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const undoActionId = newId("agentAction");
  let reversal: Record<string, unknown> = {};

  await db.transaction(async (tx) => {
    reversal = await dispatcher.execute(ctx, action, tx, now);

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
      operation: "action.undo",
      targetKind: action.targetKind,
      targetId: action.targetId,
      metadata: {
        undidActionId: action.id,
        originalOperation: action.operation,
        reversal,
      },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: undoActionId });

    if (idempotencyKey) {
      const body: UndoActionResult = {
        undoneActionId: actionId,
        operation: action.operation,
        reversal,
        agentActionId: undoActionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "action.undo",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return {
    undoneActionId: actionId,
    operation: action.operation,
    reversal,
    agentActionId: undoActionId,
    dryRun: false,
    replayed: false,
  };
}

// ───────────────────────────────────────── dispatchers

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type UndoDispatcher = {
  plan: (ctx: CallerContext, action: AgentActionFull) => Promise<Record<string, unknown>>;
  execute: (
    ctx: CallerContext,
    action: AgentActionFull,
    tx: Tx,
    now: string,
  ) => Promise<Record<string, unknown>>;
};

const undoDispatchers: Record<string, UndoDispatcher> = {
  "account.update": {
    plan: async (_ctx, a) => ({
      willRestore: a.metadata?.["before"] as Record<string, unknown> | undefined,
    }),
    execute: async (ctx, a, tx) => {
      const before = a.metadata?.["before"] as
        | { name: string | null; email: string; updatedAt?: string }
        | undefined;
      if (!before) throw new ApiError({ code: "CONFLICT", message: "No before-snapshot" });
      await tx
        .update(accounts)
        .set({ name: before.name, email: before.email })
        .where(eq(accounts.id, ctx.accountId));
      return { restored: before };
    },
  },

  "api_key.create": {
    plan: async (_ctx, a) => ({ willRevokeApiKeyId: a.targetId }),
    execute: async (ctx, a, tx, now) => {
      await tx
        .update(apiKeys)
        .set({ revokedAt: now })
        .where(and(eq(apiKeys.id, a.targetId), eq(apiKeys.accountId, ctx.accountId)));
      return { revokedApiKeyId: a.targetId };
    },
  },

  "api_key.revoke": {
    plan: async (_ctx, a) => ({ willUnrevokeApiKeyId: a.targetId }),
    execute: async (ctx, a, tx) => {
      await tx
        .update(apiKeys)
        .set({ revokedAt: null })
        .where(and(eq(apiKeys.id, a.targetId), eq(apiKeys.accountId, ctx.accountId)));
      return { unrevokedApiKeyId: a.targetId };
    },
  },
};
