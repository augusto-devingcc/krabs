import { Hono } from "hono";
import { apiKeyAuth } from "../../api/middleware/auth.js";
import { wrap } from "../../contract/envelope.js";
import { ApiError } from "../../contract/errors.js";
import { parseOrThrow } from "../../api/helpers.js";
import { sendEmail, sendEmailInputSchema } from "../../integrations/resend/send.js";

export const emailRoute = new Hono();
emailRoute.use("*", apiKeyAuth);

emailRoute.post("/send", async (c) => {
  const auth = c.get("auth");
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new ApiError({ code: "VALIDATION_FAILED", message: "Body must be a JSON object" });
  }
  // Accept both `replyTo`/`reply_to` and `contactId`/`contact_id` to be friendly
  // to JSON conventions across CLI/MCP clients.
  const normalized = normalizeRequest(raw as Record<string, unknown>);
  const data = parseOrThrow(sendEmailInputSchema, normalized);
  const result = await sendEmail(auth, data);
  return c.json(
    wrap({
      interaction_id: result.interactionId,
      message_id: result.messageId,
      agent_action_id: result.agentActionId,
      from: result.from,
      to: result.to,
    }),
    201,
  );
});

function normalizeRequest(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  if ("reply_to" in out && !("replyTo" in out)) {
    out.replyTo = out.reply_to;
    delete out.reply_to;
  }
  if ("contact_id" in out && !("contactId" in out)) {
    out.contactId = out.contact_id;
    delete out.contact_id;
  }
  return out;
}
