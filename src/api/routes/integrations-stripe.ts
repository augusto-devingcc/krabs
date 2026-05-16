import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import {
  connectStripe,
  connectStripeInputSchema,
  disconnectStripe,
  getStripeStatus,
} from "../../integrations/stripe/connect.js";
import { parseOrThrow } from "../../api/helpers.js";

export const integrationsStripeRoute = new Hono();
integrationsStripeRoute.use("*", apiKeyAuth);

integrationsStripeRoute.get("/status", async (c) => {
  const auth = c.get("auth");
  const result = await getStripeStatus(auth);
  return c.json(wrap(result));
});

integrationsStripeRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(connectStripeInputSchema, raw);
  const result = await connectStripe(auth, data);
  return c.json(wrap(result), 201);
});

integrationsStripeRoute.delete("/", async (c) => {
  const auth = c.get("auth");
  const result = await disconnectStripe(auth);
  return c.json(wrap(result));
});
