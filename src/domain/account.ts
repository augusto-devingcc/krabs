import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { accounts, agentActions } from "../db/schema.js";
import { ApiError } from "../contract/errors.js";
import { newId } from "../contract/ids.js";
import {
  lookupIdempotent,
  buildAction,
  buildIdempotencyRecord,
  idempotencyKeys,
  type CallerContext,
  type MutationOptions,
} from "./shared.js";

export const accountUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(200).nullable().optional(),
  email: z.string().trim().email().optional(),
});

export type AccountUpdateInput = z.infer<typeof accountUpdateInputSchema>;

export type Account = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getAccount(ctx: CallerContext): Promise<Account> {
  const row = await db.select().from(accounts).where(eq(accounts.id, ctx.accountId)).limit(1).then((r) => r[0]);
  if (!row) throw new ApiError({ code: "NOT_FOUND", message: "Account not found" });
  return row;
}

export type UpdateAccountResult = {
  account: Account;
  before: Account;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export async function updateAccount(
  ctx: CallerContext,
  patch: AccountUpdateInput,
  options: MutationOptions = {},
): Promise<UpdateAccountResult> {
  const { idempotencyKey, intent, dryRun = false } = options;

  if (idempotencyKey && !dryRun) {
    const cache = await lookupIdempotent<UpdateAccountResult>(ctx, idempotencyKey, "account.update");
    if (cache.hit) return { ...cache.body, replayed: true };
  }

  const before = await getAccount(ctx);
  const now = new Date().toISOString();
  const next: Account = {
    ...before,
    name: patch.name === undefined ? before.name : patch.name,
    email: patch.email ?? before.email,
    updatedAt: now,
  };

  if (dryRun) {
    return { account: next, before, agentActionId: null, dryRun: true, replayed: false };
  }

  const actionId = newId("agentAction");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(accounts)
        .set({ name: next.name, email: next.email, updatedAt: now })
        .where(eq(accounts.id, ctx.accountId));

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
        operation: "account.update",
        targetKind: "account",
        targetId: ctx.accountId,
        metadata: { before, patch },
        createdAt: now,
      };
      if (intent) actionOpts.intent = intent;
      await tx.insert(agentActions).values({ ...buildAction(actionOpts), id: actionId });

      if (idempotencyKey) {
        const body: UpdateAccountResult = {
          account: next,
          before,
          agentActionId: actionId,
          dryRun: false,
          replayed: false,
        };
        await tx.insert(idempotencyKeys).values(
          buildIdempotencyRecord({
            ctx,
            key: idempotencyKey,
            operation: "account.update",
            responseStatus: 200,
            responseBody: body,
          }),
        );
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed: accounts.email")) {
      throw new ApiError({
        code: "CONFLICT",
        message: "Another account already uses this email",
        field: "email",
      });
    }
    throw err;
  }

  return { account: next, before, agentActionId: actionId, dryRun: false, replayed: false };
}
