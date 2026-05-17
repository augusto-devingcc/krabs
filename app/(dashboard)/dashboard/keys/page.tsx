import { and, desc, eq } from "drizzle-orm";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listApiKeys } from "../../../../src/domain/api-key.js";
import { db } from "../../../../src/db/client.js";
import { apiKeys, deviceAuthorizations } from "../../../../src/db/schema.js";
import { KeyCreator } from "./KeyCreator";
import { RevokeButton } from "./RevokeButton";
import { AuthorizeAgentForm } from "./AuthorizeAgentForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/EntityTable";

export const dynamic = "force-dynamic";

type ClientMeta = { clientName?: string };

function parseClientName(raw: string | null): string {
  if (!raw) return "Unknown agent";
  try {
    const parsed = JSON.parse(raw) as ClientMeta;
    if (parsed && typeof parsed.clientName === "string" && parsed.clientName.trim()) {
      return parsed.clientName;
    }
  } catch {
    // ignore malformed JSON
  }
  return "Unknown agent";
}

export default async function KeysPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listApiKeys(ctx, { includeRevoked: true });

  const devices = await db
    .select({
      id: deviceAuthorizations.id,
      status: deviceAuthorizations.status,
      clientMeta: deviceAuthorizations.clientMeta,
      approvedAt: deviceAuthorizations.approvedAt,
      apiKeyId: deviceAuthorizations.approvedApiKeyId,
      apiKeyLabel: apiKeys.label,
      apiKeyRevokedAt: apiKeys.revokedAt,
      apiKeyPreview: apiKeys.tokenPreview,
    })
    .from(deviceAuthorizations)
    .leftJoin(apiKeys, eq(deviceAuthorizations.approvedApiKeyId, apiKeys.id))
    .where(
      and(
        eq(deviceAuthorizations.accountId, ctx.accountId),
        eq(deviceAuthorizations.status, "approved"),
      ),
    )
    .orderBy(desc(deviceAuthorizations.approvedAt));

  const isEmpty = items.length === 0;

  const authorizeCard = (
    <section
      className="my-6 border rounded-[var(--radius-4)] bg-card p-5"
      style={{ borderColor: "var(--border-light)" }}
    >
      <p className="k-eyebrow mb-1">authorize</p>
      <h2 className="text-base font-semibold mb-1">Authorize a new agent</h2>
      <p className="k-body-sm text-muted-foreground mb-4">
        Your agent shows a code like <span className="font-mono">WDJB-MJHT</span>.
        Enter it to approve.
      </p>
      <AuthorizeAgentForm />
    </section>
  );

  const devicesSection = (
    <section className="mt-8">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="k-eyebrow mb-1">devices</p>
          <h2 className="text-base font-semibold">Authorized devices</h2>
          <p className="k-body-sm text-muted-foreground mt-1 max-w-2xl">
            Agents you&apos;ve approved through the device flow. Revoking here
            revokes their underlying API key.
          </p>
        </div>
      </div>
      {devices.length === 0 ? (
        <p
          className="k-body-sm text-muted-foreground border rounded-[var(--radius-3)] py-6 px-5"
          style={{ borderColor: "var(--border-light)" }}
        >
          No agents authorized yet. Use the form above.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>device</TableHead>
              <TableHead style={{ width: 130 }}>approved</TableHead>
              <TableHead style={{ width: 160 }}>token</TableHead>
              <TableHead style={{ width: 110 }}>status</TableHead>
              <TableHead style={{ width: 80 }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => {
              const deviceName = parseClientName(d.clientMeta);
              const isRevoked = d.apiKeyRevokedAt !== null;
              return (
                <TableRow key={d.id}>
                  <TableCell className="dt-name-l">{deviceName}</TableCell>
                  <TableCell className="dt-updated" style={{ textAlign: "left" }}>
                    {d.approvedAt ? relTime(d.approvedAt) : "—"}
                  </TableCell>
                  <TableCell className="dt-owner">
                    {d.apiKeyPreview ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`k-badge k-badge--${isRevoked ? "danger" : "success"}`}
                    >
                      {isRevoked ? "revoked" : "active"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {!isRevoked && d.apiKeyId && (
                      <RevokeButton
                        keyId={d.apiKeyId}
                        label={d.apiKeyLabel ?? deviceName}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );

  return (
    <div className="center">
      <div className="mb-8">
        <p className="k-eyebrow mb-2">crm · keys</p>
        <h1 className="center__h">Connect your agents</h1>
        <p className="k-body-sm text-muted-foreground max-w-2xl mt-2">
          One key per agent or device. Every action your agents take is recorded
          against the key, so the audit log tells you exactly which client did
          what.
        </p>
      </div>

      {isEmpty ? (
        <>
          <section
            className="border rounded-[var(--radius-4)] bg-card p-6"
            style={{ borderColor: "var(--border-light)" }}
          >
            <p className="k-eyebrow mb-2">get started</p>
            <h2 className="text-lg font-semibold mb-2">Generate your first API key</h2>
            <p className="k-body-sm text-muted-foreground max-w-xl mb-6">
              Name it after the agent or device that&apos;ll use it — like
              &ldquo;Claude Desktop on MacBook&rdquo; — so the audit log stays
              readable.
            </p>
            <KeyCreator embedded />
          </section>

          {authorizeCard}
          {devicesSection}
        </>
      ) : (
        <>
          <KeyCreator />
          {authorizeCard}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>label</TableHead>
                <TableHead style={{ width: 90 }}>type</TableHead>
                <TableHead style={{ width: 150 }}>preview</TableHead>
                <TableHead style={{ width: 110 }}>last used</TableHead>
                <TableHead style={{ width: 100 }}>status</TableHead>
                <TableHead style={{ width: 110 }}>created</TableHead>
                <TableHead style={{ width: 80 }} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((k) => {
                const isSystem = k.label === "Web Dashboard";
                return (
                  <TableRow key={k.id}>
                    <TableCell className="dt-name-l">{k.label}</TableCell>
                    <TableCell>
                      <span
                        className={`k-badge k-badge--${isSystem ? "neutral" : "accent"}`}
                      >
                        {isSystem && null}
                        {!isSystem && <span className="k-badge__dot" />}
                        {isSystem ? "system" : "agent"}
                      </span>
                    </TableCell>
                    <TableCell className="dt-owner">{k.tokenPreview}</TableCell>
                    <TableCell className="dt-owner">
                      {k.lastUsedAt ? relTime(k.lastUsedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`k-badge k-badge--${k.revokedAt ? "danger" : "success"}`}
                      >
                        {k.revokedAt ? "revoked" : "active"}
                      </span>
                    </TableCell>
                    <TableCell className="dt-owner">{relTime(k.createdAt)}</TableCell>
                    <TableCell>
                      {!k.revokedAt && !isSystem && (
                        <RevokeButton keyId={k.id} label={k.label} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {devicesSection}
        </>
      )}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
