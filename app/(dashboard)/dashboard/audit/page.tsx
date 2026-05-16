import Link from "next/link";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listActions } from "../../../../src/domain/contact.js";
import { reversibilityOf } from "../../../../src/domain/action.js";
import { ActionRow, type AuditRow } from "./ActionRow";

export const dynamic = "force-dynamic";

type Filter = "all" | "reversible" | "destructive";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    apiKeyId?: string;
    targetId?: string;
    filter?: string;
  }>;
}) {
  const { ctx } = await getDashboardContext();
  const sp = await searchParams;

  const filter: Filter =
    sp.filter === "reversible" || sp.filter === "destructive" ? sp.filter : "all";

  const opts: {
    limit: number;
    targetKind?: string;
    apiKeyId?: string;
    targetId?: string;
  } = { limit: 100 };
  if (sp.kind) opts.targetKind = sp.kind;
  if (sp.apiKeyId) opts.apiKeyId = sp.apiKeyId;
  if (sp.targetId) opts.targetId = sp.targetId;

  const raw = await listActions(ctx, opts);

  const rows: AuditRow[] = raw.map((a) => ({
    id: a.id,
    apiKeyId: a.apiKeyId,
    operation: a.operation,
    targetKind: a.targetKind,
    targetId: a.targetId,
    intent: a.intent,
    metadata: a.metadata,
    createdAt: a.createdAt,
    reversibility: reversibilityOf(a.operation),
  }));

  const filtered = rows.filter((r) => {
    if (filter === "reversible") return r.reversibility === "reversible";
    if (filter === "destructive") {
      const op = r.operation;
      return (
        op.includes("delete") ||
        op.includes("revoke") ||
        op.includes("remove") ||
        op.includes(".destroy")
      );
    }
    return true;
  });

  const activeChips: { label: string; clearHref: string }[] = [];
  if (sp.kind)
    activeChips.push({
      label: `kind: ${sp.kind}`,
      clearHref: buildHref(sp, { kind: undefined }),
    });
  if (sp.apiKeyId)
    activeChips.push({
      label: `apiKey: ${sp.apiKeyId.slice(0, 8)}…`,
      clearHref: buildHref(sp, { apiKeyId: undefined }),
    });
  if (sp.targetId)
    activeChips.push({
      label: `target: ${sp.targetId.slice(0, 8)}…`,
      clearHref: buildHref(sp, { targetId: undefined }),
    });

  return (
    <div className="p-8 max-w-6xl">
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
        # audit log
      </p>
      <h1 className="text-3xl font-medium mb-2">What your agents did</h1>
      <p className="text-[var(--color-fg-muted)] mb-6 max-w-2xl">
        Every mutation — by you, the CLI, the MCP, or any of your agents — is here. Reversible
        ones can be undone with one click. Undoing is itself logged.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4 font-mono text-xs">
        <FilterChip
          label="all"
          active={filter === "all"}
          href={buildHref(sp, { filter: undefined })}
        />
        <FilterChip
          label="reversible only"
          active={filter === "reversible"}
          href={buildHref(sp, { filter: "reversible" })}
        />
        <FilterChip
          label="destructive ops"
          active={filter === "destructive"}
          href={buildHref(sp, { filter: "destructive" })}
        />
        {activeChips.map((c) => (
          <Link
            key={c.label}
            href={c.clearHref}
            className="inline-flex items-center gap-1.5 px-2 py-1 border border-[var(--color-border-strong)] rounded-full text-[var(--color-fg-muted)] hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"
          >
            <span>{c.label}</span>
            <span className="text-[var(--color-fg-faint)]">×</span>
          </Link>
        ))}
      </div>

      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden font-mono text-xs">
        <div className="bg-[var(--color-surface-2)] px-4 py-2 text-[var(--color-fg-muted)] flex items-center gap-3 border-b border-[var(--color-border)]">
          <span className="text-[var(--color-fg-faint)]">●</span>
          <span>$ socrm action list</span>
          <span className="ml-auto text-[var(--color-fg-faint)]">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-fg-muted)]">
              <p className="mb-3">(no actions match)</p>
              <p className="text-[var(--color-fg-faint)]">
                Once an agent (or you) does anything, it shows up here in real time.
              </p>
            </div>
          ) : (
            filtered.map((a) => <ActionRow key={a.id} a={a} />)
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-block px-2.5 py-1 border rounded-full transition-colors ${
        active
          ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
          : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"
      }`}
    >
      {label}
    </Link>
  );
}

function buildHref(
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v) next[k] = v;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return qs ? `/dashboard/audit?${qs}` : "/dashboard/audit";
}
