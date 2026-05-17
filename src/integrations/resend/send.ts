import { z } from "zod";
import { db } from "../../db/client.js";
import { agentActions, interactions } from "../../db/schema.js";
import { newId } from "../../contract/ids.js";
import { ApiError } from "../../contract/errors.js";
import { decryptSecret } from "../../lib/encryption.js";
import { logger } from "../../lib/logger.js";
import { buildAction, type CallerContext } from "../../domain/shared.js";
import { getResendClient } from "./client.js";
import { requireActiveResendIntegration } from "./connect.js";
import { getFirstVerifiedDomain } from "./domains.js";
import { contacts } from "../../db/schema.js";
import { and, eq } from "drizzle-orm";

const recipientSchema = z.union([
  z.string().email(),
  z.array(z.string().email()).min(1).max(50),
]);

export const sendEmailInputSchema = z
  .object({
    to: recipientSchema,
    subject: z.string().min(1).max(998),
    html: z.string().optional(),
    text: z.string().optional(),
    from: z.string().min(3).max(255).optional(),
    replyTo: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    contactId: z.string().optional(),
  })
  .refine((v) => Boolean(v.html ?? v.text), {
    message: "Either html or text body is required",
    path: ["html"],
  });

export type SendEmailInput = z.input<typeof sendEmailInputSchema>;

export type SendEmailResult = {
  interactionId: string;
  messageId: string;
  agentActionId: string;
  from: string;
  to: string[];
};

function asArray(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}

// TODO: gate by accounts.plan === 'pro' | 'enterprise' once billing ships
export async function sendEmail(
  ctx: CallerContext,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const parsed = sendEmailInputSchema.parse(input);
  const integration = await requireActiveResendIntegration(ctx);

  // Default from-address: noreply@<first verified domain>. We require at least
  // one verified domain — sending from an unverified domain would be rejected
  // by Resend at the API level anyway and the error there is unfriendly.
  let fromAddress = parsed.from;
  if (!fromAddress) {
    const verified = await getFirstVerifiedDomain(ctx);
    if (!verified) {
      throw new ApiError({
        code: "VALIDATION_FAILED",
        message: "No verified sending domain on file",
        hint: "Add and verify a domain at /dashboard/settings/integrations/resend, or pass an explicit `from` whose domain you have verified in Resend.",
      });
    }
    fromAddress = `noreply@${verified.domain}`;
  }

  if (parsed.contactId) {
    const c = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, parsed.contactId), eq(contacts.accountId, ctx.accountId)))
      .limit(1)
      .then((r) => r[0]);
    if (!c) {
      throw new ApiError({
        code: "NOT_FOUND",
        message: `Contact ${parsed.contactId} not found`,
      });
    }
  }

  const resend = getResendClient(decryptSecret(integration.secretKeyEncrypted));

  const payload = {
    from: fromAddress,
    to: parsed.to,
    subject: parsed.subject,
    ...(parsed.html ? { html: parsed.html } : {}),
    ...(parsed.text ? { text: parsed.text } : {}),
    ...(parsed.replyTo ? { replyTo: parsed.replyTo } : {}),
    ...(parsed.cc ? { cc: parsed.cc } : {}),
    ...(parsed.bcc ? { bcc: parsed.bcc } : {}),
  } as Parameters<typeof resend.emails.send>[0];

  const sent = await resend.emails.send(payload);
  if (sent.error || !sent.data) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Resend failed to send the email",
      hint: sent.error?.message ?? "Unknown Resend error",
    });
  }

  const now = new Date().toISOString();
  const interactionId = newId("interaction");
  const actionId = newId("agentAction");
  const toList = asArray(parsed.to);

  const metadata = {
    messageId: sent.data.id,
    from: fromAddress,
    to: toList,
    ...(parsed.cc ? { cc: asArray(parsed.cc) } : {}),
    ...(parsed.bcc ? { bcc: asArray(parsed.bcc) } : {}),
    ...(parsed.replyTo ? { replyTo: asArray(parsed.replyTo) } : {}),
    provider: "resend" as const,
    integrationId: integration.id,
  };

  await db.transaction(async (tx) => {
    await tx.insert(interactions).values({
      id: interactionId,
      accountId: ctx.accountId,
      contactId: parsed.contactId ?? null,
      kind: "email_out",
      direction: "outbound",
      source: "resend",
      subject: parsed.subject,
      body: parsed.html ?? parsed.text ?? null,
      metadata: JSON.stringify(metadata),
      occurredAt: now,
      createdAt: now,
    });
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "email.send",
        targetKind: "interaction",
        targetId: interactionId,
        metadata: {
          messageId: sent.data!.id,
          from: fromAddress,
          to: toList,
          subject: parsed.subject,
          contactId: parsed.contactId ?? null,
        },
        createdAt: now,
      }),
      id: actionId,
    });
  });

  logger.info(
    {
      accountId: ctx.accountId,
      messageId: sent.data.id,
      from: fromAddress,
      to: toList,
    },
    "resend email sent",
  );

  return {
    interactionId,
    messageId: sent.data.id,
    agentActionId: actionId,
    from: fromAddress,
    to: toList,
  };
}
