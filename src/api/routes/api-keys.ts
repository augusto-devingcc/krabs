import { Hono } from "hono";
import { apiKeyAuth } from "@/api/middleware/auth.js";
import { wrap } from "@/contract/envelope.js";
import { ApiError } from "@/contract/errors.js";
import { idSchema } from "@/contract/ids.js";
import {
  apiKeyCreateInputSchema,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/domain/api-key.js";
import { readMutationOptions, parseOrThrow } from "@/api/helpers.js";

export const apiKeysRoute = new Hono();
apiKeysRoute.use("*", apiKeyAuth);

apiKeysRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const includeRevoked = c.req.query("include_revoked") === "1";
  const result = await listApiKeys(auth, { includeRevoked });
  return c.json(wrap(result));
});

apiKeysRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const opts = readMutationOptions(c);
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(apiKeyCreateInputSchema, raw);
  const result = await createApiKey(auth, data, opts);
  return c.json(wrap(result), result.replayed ? 200 : 201);
});

apiKeysRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  if (!idSchema("apiKey").safeParse(id).success) {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Invalid api key id", field: "id" });
  }
  const opts = readMutationOptions(c);
  const result = await revokeApiKey(auth, id, opts);
  return c.json(wrap(result));
});
