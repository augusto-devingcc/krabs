import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { accounts } from "../../db/schema.js";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";

export const meRoute = new Hono();

meRoute.use("*", apiKeyAuth);

meRoute.get("/", async (c) => {
  const { accountId, apiKeyId } = c.get("auth");

  const account = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)
    .then((r) => r[0]);

  if (!account) {
    throw new ApiError({ code: "NOT_FOUND", message: "Account not found" });
  }

  return c.json(wrap({ account, apiKeyId }));
});
