import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import {
  agentActions,
  emailDomains,
  type EmailDomainRow,
  type EmailDomainStatus,
} from "../../db/schema.js";
import { newId } from "../../contract/ids.js";
import { ApiError } from "../../contract/errors.js";
import { decryptSecret } from "../../lib/encryption.js";
import { logger } from "../../lib/logger.js";
import { buildAction, type CallerContext } from "../../domain/shared.js";
import { getResendClient } from "./client.js";
import { requireActiveResendIntegration } from "./connect.js";

// Loose domain regex — accepts internationalized roots but rejects obvious
// junk. Resend will reject anything more nuanced on its own.
const domainRegex = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export const addDomainInputSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(253)
    .regex(domainRegex, "Domain must be a valid hostname (e.g. acme.com)"),
});

export type AddDomainInput = z.input<typeof addDomainInputSchema>;

export type EmailDomainDnsRecord = {
  record?: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  status?: string;
  priority?: number;
};

export type EmailDomainSummary = {
  id: string;
  domain: string;
  status: EmailDomainStatus;
  region: string | null;
  resendDomainId: string | null;
  dnsRecords: EmailDomainDnsRecord[];
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

function rowToSummary(row: EmailDomainRow): EmailDomainSummary {
  let dns: EmailDomainDnsRecord[] = [];
  if (row.dnsRecords) {
    try {
      const parsed = JSON.parse(row.dnsRecords);
      if (Array.isArray(parsed)) dns = parsed as EmailDomainDnsRecord[];
    } catch {
      dns = [];
    }
  }
  return {
    id: row.id,
    domain: row.domain,
    status: row.status as EmailDomainStatus,
    region: row.region,
    resendDomainId: row.resendDomainId,
    dnsRecords: dns,
    lastVerifiedAt: row.lastVerifiedAt,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Resend returns `partially_verified` and `partially_failed` for domains where
// only some DNS records are correct. We collapse those into `pending` so the
// UI surfaces them as "still needs DNS work" rather than as a hard fail.
function mapResendStatus(resendStatus: string | undefined | null): EmailDomainStatus {
  if (resendStatus === "verified") return "verified";
  if (resendStatus === "failed") return "failed";
  return "pending";
}

export async function listDomains(
  ctx: CallerContext,
): Promise<{ items: EmailDomainSummary[] }> {
  const rows = await db
    .select()
    .from(emailDomains)
    .where(eq(emailDomains.accountId, ctx.accountId))
    .orderBy(asc(emailDomains.createdAt));
  return { items: rows.map(rowToSummary) };
}

export async function getDomain(
  ctx: CallerContext,
  domainId: string,
): Promise<EmailDomainRow> {
  const row = await db
    .select()
    .from(emailDomains)
    .where(
      and(eq(emailDomains.id, domainId), eq(emailDomains.accountId, ctx.accountId)),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!row) {
    throw new ApiError({ code: "NOT_FOUND", message: `Email domain ${domainId} not found` });
  }
  return row;
}

export async function addDomain(
  ctx: CallerContext,
  input: AddDomainInput,
): Promise<{ domain: EmailDomainSummary; agentActionId: string }> {
  const parsed = addDomainInputSchema.parse(input);
  const integration = await requireActiveResendIntegration(ctx);

  const existing = await db
    .select()
    .from(emailDomains)
    .where(
      and(
        eq(emailDomains.accountId, ctx.accountId),
        eq(emailDomains.domain, parsed.domain),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (existing) {
    throw new ApiError({
      code: "CONFLICT",
      message: `Domain ${parsed.domain} is already registered`,
      hint: "Use verify to refresh status, or delete first to re-add",
    });
  }

  const resend = getResendClient(decryptSecret(integration.secretKeyEncrypted));
  const created = await resend.domains.create({
    name: parsed.domain,
    region: "us-east-1",
  });
  if (created.error || !created.data) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Resend rejected the domain",
      hint: created.error?.message ?? "Unknown Resend error",
    });
  }

  // Records are returned only at create-time; persist them so the UI can keep
  // showing the DNS to add without re-calling Resend on every page load.
  const records = (created.data.records ?? []).map((r) => ({
    record: r.record,
    name: r.name,
    type: r.type,
    value: r.value,
    ttl: r.ttl,
    status: r.status,
    priority: "priority" in r ? r.priority : undefined,
  }));

  const now = new Date().toISOString();
  const id = newId("emailDomain");
  const actionId = newId("agentAction");
  const row: EmailDomainRow = {
    id,
    accountId: ctx.accountId,
    integrationId: integration.id,
    domain: parsed.domain,
    resendDomainId: created.data.id,
    status: mapResendStatus(created.data.status),
    dnsRecords: JSON.stringify(records),
    region: created.data.region ?? null,
    lastVerifiedAt: null,
    lastErrorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(async (tx) => {
    await tx.insert(emailDomains).values(row);
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "email_domain.add",
        targetKind: "email_domain",
        targetId: id,
        metadata: { domain: parsed.domain, resendDomainId: created.data!.id },
        createdAt: now,
      }),
      id: actionId,
    });
  });

  logger.info(
    { accountId: ctx.accountId, domain: parsed.domain, resendDomainId: created.data.id },
    "resend domain added",
  );

  return { domain: rowToSummary(row), agentActionId: actionId };
}

export async function verifyDomain(
  ctx: CallerContext,
  domainId: string,
): Promise<{ domain: EmailDomainSummary; agentActionId: string }> {
  const row = await getDomain(ctx, domainId);
  if (!row.resendDomainId) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Domain has no Resend id on file",
      hint: "Remove and re-add the domain",
    });
  }
  const integration = await requireActiveResendIntegration(ctx);
  const resend = getResendClient(decryptSecret(integration.secretKeyEncrypted));

  // Resend's `verify(id)` triggers a re-check; the resulting status is then
  // read with `get(id)` which also re-returns the DNS records so we keep them
  // current (Resend's record list can rotate when DKIM keys roll).
  const triggered = await resend.domains.verify(row.resendDomainId);
  if (triggered.error) {
    const now = new Date().toISOString();
    await db
      .update(emailDomains)
      .set({
        status: "failed",
        lastVerifiedAt: now,
        lastErrorMessage: triggered.error.message,
        updatedAt: now,
      })
      .where(eq(emailDomains.id, row.id));
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Resend rejected the verify request",
      hint: triggered.error.message,
    });
  }

  const fresh = await resend.domains.get(row.resendDomainId);
  if (fresh.error || !fresh.data) {
    throw new ApiError({
      code: "VALIDATION_FAILED",
      message: "Resend could not return the domain after verify",
      hint: fresh.error?.message ?? "Unknown Resend error",
    });
  }

  const records = (fresh.data.records ?? []).map((r) => ({
    record: r.record,
    name: r.name,
    type: r.type,
    value: r.value,
    ttl: r.ttl,
    status: r.status,
    priority: "priority" in r ? r.priority : undefined,
  }));

  const newStatus = mapResendStatus(fresh.data.status);
  const now = new Date().toISOString();
  const actionId = newId("agentAction");

  await db.transaction(async (tx) => {
    await tx
      .update(emailDomains)
      .set({
        status: newStatus,
        dnsRecords: JSON.stringify(records),
        region: fresh.data!.region ?? row.region,
        lastVerifiedAt: now,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(eq(emailDomains.id, row.id));
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "email_domain.verify",
        targetKind: "email_domain",
        targetId: row.id,
        metadata: { domain: row.domain, status: newStatus },
        createdAt: now,
      }),
      id: actionId,
    });
  });

  const updated: EmailDomainRow = {
    ...row,
    status: newStatus,
    dnsRecords: JSON.stringify(records),
    region: fresh.data.region ?? row.region,
    lastVerifiedAt: now,
    lastErrorMessage: null,
    updatedAt: now,
  };

  return { domain: rowToSummary(updated), agentActionId: actionId };
}

export async function removeDomain(
  ctx: CallerContext,
  domainId: string,
): Promise<{ removed: true; agentActionId: string }> {
  const row = await getDomain(ctx, domainId);
  const integration = await requireActiveResendIntegration(ctx);

  if (row.resendDomainId) {
    try {
      const resend = getResendClient(decryptSecret(integration.secretKeyEncrypted));
      await resend.domains.remove(row.resendDomainId);
    } catch (err) {
      logger.warn(
        {
          accountId: ctx.accountId,
          resendDomainId: row.resendDomainId,
          err: err instanceof Error ? err.message : String(err),
        },
        "failed to remove resend domain; proceeding with local delete",
      );
    }
  }

  const now = new Date().toISOString();
  const actionId = newId("agentAction");
  await db.transaction(async (tx) => {
    await tx.insert(agentActions).values({
      ...buildAction({
        ctx,
        operation: "email_domain.remove",
        targetKind: "email_domain",
        targetId: row.id,
        metadata: { domain: row.domain, resendDomainId: row.resendDomainId },
        createdAt: now,
      }),
      id: actionId,
    });
    await tx.delete(emailDomains).where(eq(emailDomains.id, row.id));
  });

  return { removed: true, agentActionId: actionId };
}

export async function getFirstVerifiedDomain(
  ctx: CallerContext,
): Promise<EmailDomainRow | undefined> {
  return db
    .select()
    .from(emailDomains)
    .where(
      and(
        eq(emailDomains.accountId, ctx.accountId),
        eq(emailDomains.status, "verified"),
      ),
    )
    .orderBy(asc(emailDomains.createdAt))
    .limit(1)
    .then((r) => r[0]);
}
