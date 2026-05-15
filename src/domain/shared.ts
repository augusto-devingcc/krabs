import { and, eq } from "drizzle-orm";
import { db } from "@/db/client.js";
import { agentActions, idempotencyKeys } from "@/db/schema.js";
import { newId } from "@/contract/ids.js";
import { ApiError } from "@/contract/errors.js";

export type CallerContext = {
  accountId: string;
  apiKeyId: string;
};

export type MutationOptions = {
  idempotencyKey?: string;
  intent?: string;
  dryRun?: boolean;
};

export type IdempotentLookup<T> =
  | { hit: true; body: T }
  | { hit: false };

export async function lookupIdempotent<T>(
  ctx: CallerContext,
  key: string,
  operation: string,
): Promise<IdempotentLookup<T>> {
  const cached = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.accountId, ctx.accountId), eq(idempotencyKeys.key, key)))
    .limit(1)
    .then((r) => r[0]);

  if (!cached) return { hit: false };

  if (cached.operation !== operation) {
    throw new ApiError({
      code: "IDEMPOTENCY_CONFLICT",
      message: "Idempotency key reused for a different operation",
      hint: `Original operation was '${cached.operation}'`,
    });
  }

  return { hit: true, body: JSON.parse(cached.responseBody) as T };
}

export function buildAction(args: {
  ctx: CallerContext;
  operation: string;
  targetKind: string;
  targetId: string;
  intent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}) {
  return {
    id: newId("agentAction"),
    accountId: args.ctx.accountId,
    apiKeyId: args.ctx.apiKeyId,
    operation: args.operation,
    targetKind: args.targetKind,
    targetId: args.targetId,
    intent: args.intent ?? null,
    metadata: args.metadata ? JSON.stringify(args.metadata) : null,
    createdAt: args.createdAt,
  };
}

export function buildIdempotencyRecord(args: {
  ctx: CallerContext;
  key: string;
  operation: string;
  responseStatus: number;
  responseBody: unknown;
}) {
  return {
    id: newId("idempotencyKey"),
    accountId: args.ctx.accountId,
    apiKeyId: args.ctx.apiKeyId,
    key: args.key,
    operation: args.operation,
    responseStatus: args.responseStatus,
    responseBody: JSON.stringify(args.responseBody),
  };
}

export { agentActions, idempotencyKeys };
