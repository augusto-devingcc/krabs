import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import {
  agentActions,
  emailDomains,
  integrations,
  type IntegrationRow,
} from "../../db/schema.js";
import { newId } from "../../contract/ids.js";
import { ApiError } from "../../contract/errors.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/encryption.js";
import { logger } from "../../lib/logger.js";
import { buildAction, type CallerContext } from "../../domain/shared.js";
import { getResendClient } from "./client.js";

export const connectResendInputSchema = z.object({
  secretKey: z.string().min(10).max(255),
  displayName: z.string().trim().min(1).max(100),
});

export type ConnectResendInput = z.input<typeof connectResendInputSchema>;

export type ResendIntegrationSummary = {
  id: string;
  accountId: string;
  provider: "resend";
  displayName: string;
  status: IntegrationRow["status"];
  maskedSecret: string;
  lastSyncedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectResendResult = {
  integration: ResendIntegrationSummary;
  agentActionId: string;
};

export type DisconnectResendResult = {
  disconnected: boolean;
  integration: ResendIntegrationSummary | null;
  agentActionId: string | null;
};

export type ResendStatus =
  | { connected: false }
  | {
      connected: true;
      displayName: string;
      status: IntegrationRow["status"];
      lastSyncedAt: string | null;
      lastErrorMessage: string | null;
      maskedSecret: string;
      domainCount: number;
      verifiedDomainCount: number;
    };

function rowToSummary(row: IntegrationRow): ResendIntegrationSummary {
  return {
    id: row.id,
    accountId: row.accountId,
    provider: "resend",
    displayName: row.displayName,
    status: row.status,
    maskedSecret: maskSecret(decryptSecret(row.secretKeyEncrypted), 4),
    lastSyncedAt: row.lastSyncedAt,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getActiveResendIntegration(
  ctx: CallerContext,
): Promise<IntegrationRow | undefined> {
  return db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.accountId, ctx.accountId),
        eq(integrations.provider, "resend"),
        eq(integrations.status, "active"),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
}

export async function getResendIntegrationRow(
  ctx: CallerContext,
): Promise<IntegrationRow | undefined> {
  return db
    .select()
    .from(integrations)
    .where(and(eq(integrations.accountId, ctx.accountId), eq(integrations.provider, "resend")))
    .limit(1)
    .then((r) => r[0]);
}

// Throws if the account has no active Resend integration — used by send.ts and
// domain ops to bail loudly before hitting the Resend API.
export async function requireActiveResendIntegration(
  ctx: CallerContext,
): Promise<IntegrationRow> {
  const row = await getActiveResendIntegration(ctx);
  if (!row) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Resend is not connected for this account",
      hint: "Connect Resend at /dashboard/settings/integrations/resend",
    });
  }
  return row;
}

export async function connectResend(
  ctx: CallerContext,
  input: ConnectResendInput,
): Promise<ConnectResendResult> {
  const parsed = connectResendInputSchema.parse(input);

  const existingActive = await getActiveResendIntegration(ctx);
  if (existingActive) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Resend is already connected to this account",
      hint: "Disconnect first, then reconnect with the new key",
    });
  }

  const resend = getResendClient(parsed.secretKey);

  // Validate the key by listing domains — cheapest authenticated call that
  // requires a valid Resend API key with the default scopes.
  const probe = await resend.domains.list();
  if (probe.error) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Resend rejected the API key",
      hint: probe.error.message,
    });
  }

  const now = new Date().toISOString();
  const integrationId = newId("integration");
  const actionId = newId("agentAction");
  const row: IntegrationRow = {
    id: integrationId,
    accountId: ctx.accountId,
    provider: "resend",
    displayName: parsed.displayName,
    secretKeyEncrypted: encryptSecret(parsed.secretKey),
    webhookSecretEncrypted: null,
    webhookEndpointId: null,
    providerAccountId: null,
    status: "active",
    lastSyncedAt: now,
    lastErrorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(async (tx) => {
    await tx.insert(integrations).values(row);
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "integration.connect",
        targetKind: "integration",
        targetId: integrationId,
        metadata: {
          provider: "resend",
          displayName: parsed.displayName,
        },
        createdAt: now,
      }),
      id: actionId,
    });
  });

  logger.info(
    { accountId: ctx.accountId, integrationId },
    "resend integration connected",
  );

  return { integration: rowToSummary(row), agentActionId: actionId };
}

export async function disconnectResend(
  ctx: CallerContext,
): Promise<DisconnectResendResult> {
  const row = await getActiveResendIntegration(ctx);
  if (!row) return { disconnected: false, integration: null, agentActionId: null };

  // Best-effort cleanup: tear down each domain registered with Resend so a
  // future reconnect with a fresh key starts clean. Failures are non-fatal.
  const domains = await db
    .select()
    .from(emailDomains)
    .where(eq(emailDomains.integrationId, row.id));

  if (domains.length > 0) {
    try {
      const resend = getResendClient(decryptSecret(row.secretKeyEncrypted));
      for (const d of domains) {
        if (!d.resendDomainId) continue;
        try {
          await resend.domains.remove(d.resendDomainId);
        } catch (err) {
          logger.warn(
            {
              accountId: ctx.accountId,
              resendDomainId: d.resendDomainId,
              err: err instanceof Error ? err.message : String(err),
            },
            "failed to remove resend domain during disconnect; proceeding",
          );
        }
      }
    } catch (err) {
      logger.warn(
        {
          accountId: ctx.accountId,
          err: err instanceof Error ? err.message : String(err),
        },
        "failed to instantiate resend client during disconnect; proceeding",
      );
    }
  }

  const now = new Date().toISOString();
  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    // Cascade FK on email_domains.integrationId will remove the rows when the
    // integration is hard-deleted, but disconnect keeps the row and just flips
    // status — so we clean the dependent rows manually for a clean reconnect.
    await tx.delete(emailDomains).where(eq(emailDomains.integrationId, row.id));
    await tx
      .update(integrations)
      .set({ status: "disconnected", updatedAt: now })
      .where(eq(integrations.id, row.id));
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "integration.disconnect",
        targetKind: "integration",
        targetId: row.id,
        metadata: { provider: "resend", domainCount: domains.length },
        createdAt: now,
      }),
      id: actionId,
    });
  });

  const updated: IntegrationRow = { ...row, status: "disconnected", updatedAt: now };
  return { disconnected: true, integration: rowToSummary(updated), agentActionId: actionId };
}

export async function getResendStatus(ctx: CallerContext): Promise<ResendStatus> {
  const row = await getResendIntegrationRow(ctx);
  if (!row) return { connected: false };
  if (row.status !== "active") return { connected: false };

  const allDomains = await db
    .select({ id: emailDomains.id, status: emailDomains.status })
    .from(emailDomains)
    .where(eq(emailDomains.integrationId, row.id));

  return {
    connected: true,
    displayName: row.displayName,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt,
    lastErrorMessage: row.lastErrorMessage,
    maskedSecret: maskSecret(decryptSecret(row.secretKeyEncrypted), 4),
    domainCount: allDomains.length,
    verifiedDomainCount: allDomains.filter((d) => d.status === "verified").length,
  };
}
