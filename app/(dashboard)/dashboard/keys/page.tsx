import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listApiKeys } from "../../../../src/domain/api-key.js";
import { KeyCreator } from "./KeyCreator";
import { RevokeButton } from "./RevokeButton";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listApiKeys(ctx, { includeRevoked: true });

  return (
    <div className="p-8 max-w-5xl">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-2"># api keys</p>
      <h1 className="text-3xl font-medium mb-2">Connect your agents</h1>
      <p className="text-[var(--color-fg-muted)] mb-8 max-w-2xl">
        One key per agent or device. Every action your agents take is recorded against the
        key, so the audit log tells you exactly which client did what.
      </p>

      <KeyCreator />

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
            <tr>
              <Th>label</Th>
              <Th>preview</Th>
              <Th>last used</Th>
              <Th>status</Th>
              <Th>created</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-fg-muted)]">
                  (no keys yet — create one above)
                </td>
              </tr>
            ) : (
              items.map((k) => (
                <tr key={k.id} className="border-t border-[var(--color-border)]">
                  <Td>{k.label}</Td>
                  <Td mono>{k.tokenPreview}</Td>
                  <Td>{k.lastUsedAt ? relTime(k.lastUsedAt) : "—"}</Td>
                  <Td>
                    {k.revokedAt ? (
                      <span className="text-[var(--color-fg-muted)]">revoked</span>
                    ) : (
                      <span className="text-[var(--color-accent)]">active</span>
                    )}
                  </Td>
                  <Td>{relTime(k.createdAt)}</Td>
                  <Td>{!k.revokedAt && <RevokeButton keyId={k.id} label={k.label} />}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2 text-xs uppercase tracking-wide font-medium">
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-2.5 ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
