import { createMiddleware } from "hono/factory";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { apiKeys } from "../../db/schema.js";
import { ApiError } from "../../contract/errors.js";
import { sha256Hex } from "../../lib/hash.js";
import { apiKeyPlaintextRegex } from "../../contract/schemas/api-key.js";

export type AuthContext = {
  accountId: string;
  apiKeyId: string;
};

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const apiKeyAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Missing Authorization header",
      hint: "Send 'Authorization: Bearer krabs_sk_…'",
    });
  }

  const token = header.slice(7).trim();
  if (!apiKeyPlaintextRegex.test(token)) {
    throw new ApiError({
      code: "INVALID_API_KEY",
      message: "API key has an invalid format",
    });
  }

  const hash = sha256Hex(token);
  const row = await db
    .select({
      id: apiKeys.id,
      accountId: apiKeys.accountId,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.tokenHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    throw new ApiError({ code: "INVALID_API_KEY", message: "API key not recognized" });
  }

  // Fire-and-forget last-used update.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {
      /* swallow — auditing only */
    });

  c.set("auth", { accountId: row.accountId, apiKeyId: row.id });
  await next();
});
