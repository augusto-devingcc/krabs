import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { agentActions, apiKeys } from "../db/schema.js";
import { ApiError } from "../contract/errors.js";
import { newId } from "../contract/ids.js";
import { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } from "../lib/hash.js";
import {
  lookupIdempotent,
  buildAction,
  buildIdempotencyRecord,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export const apiKeyCreateInputSchema = z.object({
  label: z.string().trim().min(1).max(100),
});

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateInputSchema>;

export type ApiKeySummary = {
  id: string;
  accountId: string;
  label: string;
  tokenPreview: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function rowToSummary(row: {
  id: string;
  accountId: string;
  label: string;
  tokenPreview: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}): ApiKeySummary {
  return row;
}

export type CreateApiKeyResult = {
  apiKey: ApiKeySummary;
  token: string;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function createApiKey(
  ctx: CallerContext,
  input: ApiKeyCreateInput,
  options: MutationOptions = {},
): Promise<CreateApiKeyResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<CreateApiKeyResult>(ctx, idempotencyKey, "api_key.create");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  if (dryRun) {
    const placeholderId = newId("apiKey");
    const fakeToken = generateApiKeyPlaintext();
    return {
      apiKey: {
        id: placeholderId,
        accountId: ctx.accountId,
        label: input.label,
        tokenPreview: apiKeyPreview(fakeToken),
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      },
      token: "<dry-run: not generated>",
      agentActionId: null,
      dryRun: true,
      replayed: false,
    };
  }

  const id = newId("apiKey");
  const token = generateApiKeyPlaintext();
  const tokenHash = sha256Hex(token);
  const tokenPreview = apiKeyPreview(token);
  const now = new Date().toISOString();
  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    await tx.insert(apiKeys).values({
      id,
      accountId: ctx.accountId,
      label: input.label,
      tokenHash,
      tokenPreview,
      createdAt: now,
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
      operation: "api_key.create",
      targetKind: "api_key",
      targetId: id,
      metadata: { label: input.label, tokenPreview },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    if (idempotencyKey) {
      const body: CreateApiKeyResult = {
        apiKey: {
          id,
          accountId: ctx.accountId,
          label: input.label,
          tokenPreview,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: now,
        },
        token,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "api_key.create",
          responseStatus: 201,
          responseBody: body,
        }),
      );
    }
  });

  return {
    apiKey: {
      id,
      accountId: ctx.accountId,
      label: input.label,
      tokenPreview,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    },
    token,
    agentActionId: actionId,
    dryRun: false,
    replayed: false,
  };
}

export type ListApiKeysOptions = { includeRevoked?: boolean };

export async function listApiKeys(
  ctx: CallerContext,
  options: ListApiKeysOptions = {},
): Promise<{ items: ApiKeySummary[] }> {
  const conds = [eq(apiKeys.accountId, ctx.accountId)];
  if (!options.includeRevoked) conds.push(isNull(apiKeys.revokedAt));
  const rows = await db
    .select({
      id: apiKeys.id,
      accountId: apiKeys.accountId,
      label: apiKeys.label,
      tokenPreview: apiKeys.tokenPreview,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(...conds))
    .orderBy(desc(apiKeys.createdAt));
  return { items: rows.map(rowToSummary) };
}

export type RevokeApiKeyResult = {
  apiKey: ApiKeySummary;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function revokeApiKey(
  ctx: CallerContext,
  apiKeyId: string,
  options: MutationOptions = {},
): Promise<RevokeApiKeyResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<RevokeApiKeyResult>(ctx, idempotencyKey, "api_key.revoke");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const existing = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.accountId, ctx.accountId)))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    throw new ApiError({ code: "NOT_FOUND", message: `API key ${apiKeyId} not found` });
  }

  if (existing.revokedAt) {
    // Already revoked — return current state, not an error
    const summary: ApiKeySummary = {
      id: existing.id,
      accountId: existing.accountId,
      label: existing.label,
      tokenPreview: existing.tokenPreview,
      lastUsedAt: existing.lastUsedAt,
      revokedAt: existing.revokedAt,
      createdAt: existing.createdAt,
    };
    return { apiKey: summary, agentActionId: null, dryRun, replayed: false };
  }

  const now = new Date().toISOString();
  const revoked: ApiKeySummary = {
    id: existing.id,
    accountId: existing.accountId,
    label: existing.label,
    tokenPreview: existing.tokenPreview,
    lastUsedAt: existing.lastUsedAt,
    revokedAt: now,
    createdAt: existing.createdAt,
  };

  if (dryRun) {
    return { apiKey: revoked, agentActionId: null, dryRun: true, replayed: false };
  }

  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    await tx.update(apiKeys).set({ revokedAt: now }).where(eq(apiKeys.id, apiKeyId));

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
      operation: "api_key.revoke",
      targetKind: "api_key",
      targetId: apiKeyId,
      metadata: { label: existing.label, tokenPreview: existing.tokenPreview },
      createdAt: now,
    };
    if (intent) actionOpts.intent = intent;
    await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

    if (idempotencyKey) {
      const body: RevokeApiKeyResult = {
        apiKey: revoked,
        agentActionId: actionId,
        dryRun: false,
        replayed: false,
      };
      await tx.insert(idempotencyKeys).values(
        buildIdempotencyRecord({
          ctx,
          key: idempotencyKey,
          operation: "api_key.revoke",
          responseStatus: 200,
          responseBody: body,
        }),
      );
    }
  });

  return { apiKey: revoked, agentActionId: actionId, dryRun: false, replayed: false };
}
