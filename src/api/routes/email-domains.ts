import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { parseOrThrow } from "../../api/helpers.js";
import {
  addDomain,
  addDomainInputSchema,
  listDomains,
  removeDomain,
  verifyDomain,
} from "../../integrations/resend/domains.js";

export const emailDomainsRoute = new Hono();
emailDomainsRoute.use("*", apiKeyAuth);

emailDomainsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const result = await listDomains(auth);
  return c.json(wrap(result));
});

emailDomainsRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(addDomainInputSchema, raw);
  const result = await addDomain(auth, data);
  return c.json(wrap(result), 201);
});

emailDomainsRoute.post("/:id/verify", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const result = await verifyDomain(auth, id);
  return c.json(wrap(result));
});

emailDomainsRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const result = await removeDomain(auth, id);
  return c.json(wrap(result));
});
