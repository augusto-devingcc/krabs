import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import {
  connectResend,
  connectResendInputSchema,
  disconnectResend,
  getResendStatus,
} from "../../integrations/resend/connect.js";
import { parseOrThrow } from "../../api/helpers.js";

export const integrationsResendRoute = new Hono();
integrationsResendRoute.use("*", apiKeyAuth);

integrationsResendRoute.get("/status", async (c) => {
  const auth = c.get("auth");
  const result = await getResendStatus(auth);
  return c.json(wrap(result));
});

integrationsResendRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  const data = parseOrThrow(connectResendInputSchema, raw);
  const result = await connectResend(auth, data);
  return c.json(wrap(result), 201);
});

integrationsResendRoute.delete("/", async (c) => {
  const auth = c.get("auth");
  const result = await disconnectResend(auth);
  return c.json(wrap(result));
});
