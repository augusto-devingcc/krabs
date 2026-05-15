import { Hono } from "hono";
import { apiKeyAuth } from "@/api/middleware/auth.js";
import { wrap } from "@/contract/envelope.js";
import { ApiError } from "@/contract/errors.js";
import { getAccount, updateAccount, accountUpdateInputSchema } from "@/domain/account.js";
import { readMutationOptions, parseOrThrow } from "@/api/helpers.js";
import { attachAccountExport } from "@/api/routes/import-export.js";

export const accountRoute = new Hono();
accountRoute.use("*", apiKeyAuth);
attachAccountExport(accountRoute);

accountRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const account = await getAccount(auth);
  return c.json(wrap({ account }));
});

accountRoute.patch("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const patch = parseOrThrow(accountUpdateInputSchema, raw);
  const result = await updateAccount(auth, patch, opts);
  return c.json(wrap(result));
});
