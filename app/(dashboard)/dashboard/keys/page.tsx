import { and, desc, eq } from "drizzle-orm";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listApiKeys } from "../../../../src/domain/api-key.js";
import { db } from "../../../../src/db/client.js";
import { apiKeys, deviceAuthorizations } from "../../../../src/db/schema.js";
import { KeyCreator } from "./KeyCreator";
import { RevokeButton } from "./RevokeButton";
import { AuthorizeAgentForm } from "./AuthorizeAgentForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <Card
      className="mb-6 border-border rounded-xl"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <CardHeader>
        <p className="k-eyebrow">authorize</p>
        <CardTitle className="k-h4">Authorize a new agent</CardTitle>
        <CardDescription>
          Your agent shows a code like{" "}
          <span className="font-mono">WDJB-MJHT</span>. Enter it to approve.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthorizeAgentForm />
      </CardContent>
    </Card>
  );

  const devicesCard = (
    <Card
      className="mt-6 overflow-hidden border-border rounded-xl"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <CardHeader>
        <p className="k-eyebrow">devices</p>
        <CardTitle className="k-h4">Authorized devices</CardTitle>
        <CardDescription>
          Agents you&apos;ve approved through the device flow. Revoking here
          revokes their underlying API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {devices.length === 0 ? (
          <p className="k-body-sm text-muted-foreground px-6 pb-6">
            No agents authorized yet. Use the form above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="k-eyebrow font-medium">device</TableHead>
                <TableHead className="k-eyebrow font-medium">
                  approved
                </TableHead>
                <TableHead className="k-eyebrow font-medium">token</TableHead>
                <TableHead className="k-eyebrow font-medium">status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((d) => {
                const deviceName = parseClientName(d.clientMeta);
                const isRevoked = d.apiKeyRevokedAt !== null;
                return (
                  <TableRow key={d.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm">{deviceName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.approvedAt ? relTime(d.approvedAt) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.apiKeyPreview ?? "—"}
                    </TableCell>
                    <TableCell>
                      {isRevoked ? (
                        <span className="font-mono text-[11px] uppercase tracking-wide bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded px-1.5 py-0.5">
                          revoked
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] uppercase tracking-wide bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded px-1.5 py-0.5">
                          active
                        </span>
                      )}
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
      </CardContent>
    </Card>
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="k-eyebrow mb-2">crm · keys</p>
        <h1 className="k-h2 mb-2">Connect your agents</h1>
        <p className="k-body-sm text-muted-foreground max-w-2xl">
          One key per agent or device. Every action your agents take is recorded
          against the key, so the audit log tells you exactly which client did
          what.
        </p>
      </div>

      {isEmpty ? (
        <>
          <Card
            className="border-border rounded-xl"
            style={{ boxShadow: "var(--shadow-1)" }}
          >
            <CardContent className="py-10">
              <p className="k-eyebrow mb-2">get started</p>
              <h2 className="k-h3 mb-2">Generate your first API key</h2>
              <p className="k-body-sm text-muted-foreground max-w-xl mb-6">
                Name it after the agent or device that&apos;ll use it — like
                &ldquo;Claude Desktop on MacBook&rdquo; — so the audit log stays
                readable.
              </p>
              <KeyCreator embedded />
            </CardContent>
          </Card>

          <div className="mt-6">{authorizeCard}</div>

          {devicesCard}
        </>
      ) : (
        <>
          <KeyCreator />

          {authorizeCard}

          <Card
            className="overflow-hidden p-0 gap-0 border-border rounded-xl"
            style={{ boxShadow: "var(--shadow-1)" }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="k-eyebrow font-medium">label</TableHead>
                  <TableHead className="k-eyebrow font-medium">type</TableHead>
                  <TableHead className="k-eyebrow font-medium">
                    preview
                  </TableHead>
                  <TableHead className="k-eyebrow font-medium">
                    last used
                  </TableHead>
                  <TableHead className="k-eyebrow font-medium">
                    status
                  </TableHead>
                  <TableHead className="k-eyebrow font-medium">
                    created
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((k) => {
                  const isSystem = k.label === "Web Dashboard";
                  return (
                    <TableRow key={k.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm">{k.label}</TableCell>
                      <TableCell>
                        <span
                          className={
                            "font-mono text-[11px] uppercase tracking-wide " +
                            (isSystem
                              ? "bg-muted text-muted-foreground rounded px-1.5 py-0.5"
                              : "bg-coral-50 text-coral-700 dark:bg-coral-900/30 dark:text-coral-300 rounded px-1.5 py-0.5")
                          }
                        >
                          {isSystem ? "system" : "agent"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {k.tokenPreview}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {k.lastUsedAt ? relTime(k.lastUsedAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {k.revokedAt ? (
                          <span className="font-mono text-[11px] uppercase tracking-wide bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded px-1.5 py-0.5">
                            revoked
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] uppercase tracking-wide bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded px-1.5 py-0.5">
                            active
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {relTime(k.createdAt)}
                      </TableCell>
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
          </Card>

          {devicesCard}
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
