import Link from "next/link";
import { X } from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listActions } from "../../../../src/domain/contact.js";
import { reversibilityOf } from "../../../../src/domain/action.js";
import { ActionRow, type AuditRow } from "./ActionRow";
import { Button } from "@/components/ui/button";

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

  const reversibleCount = rows.filter((r) => r.reversibility === "reversible").length;

  return (
    <div className="rp">
      {/* Header — designer's .rp__head pattern (title + soft subtitle). */}
      <div className="rp__head">
        <div>
          <p className="k-eyebrow mb-2">crm · audit</p>
          <h2 className="rp__title">
            What your agents did
            <span className="rp__sub">last 100 actions</span>
          </h2>
          <p className="k-body-sm text-muted-foreground max-w-2xl mt-2">
            Every mutation — by you, the CLI, the MCP, or any of your agents — is
            here. Reversible ones can be undone with one click. Undoing is itself
            logged.
          </p>
        </div>
      </div>

      {/* Stats bar — designer's .rp__stats (top + bottom rules, mono labels). */}
      <div className="rp__stats">
        <div>
          <div className="rp__stat-k">entries</div>
          <div className="rp__stat-v">{filtered.length.toLocaleString()}</div>
        </div>
        <div>
          <div className="rp__stat-k">reversible</div>
          <div className="rp__stat-v">{reversibleCount.toLocaleString()}</div>
        </div>
        <div>
          <div className="rp__stat-k">filter</div>
          <div className="rp__stat-v" style={{ fontFamily: "var(--font-sans)" }}>
            {filter}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        <FilterChip label="all" active={filter === "all"} href={buildHref(sp, { filter: undefined })} />
        <FilterChip label="reversible only" active={filter === "reversible"} href={buildHref(sp, { filter: "reversible" })} />
        <FilterChip label="destructive ops" active={filter === "destructive"} href={buildHref(sp, { filter: "destructive" })} />
        {activeChips.map((c) => (
          <Button
            key={c.label}
            asChild
            variant="outline"
            size="sm"
            className="rounded-[var(--radius-2)] font-mono"
          >
            <Link href={c.clearHref}>
              <span>{c.label}</span>
              <X size={14} aria-hidden className="text-muted-foreground" />
            </Link>
          </Button>
        ))}
      </div>

      {/* Action list */}
      <div className="font-mono text-xs">
        {filtered.length === 0 ? (
          <div
            className="p-10 text-center text-muted-foreground border rounded-[var(--radius-3)]"
            style={{ borderColor: "var(--border-light)" }}
          >
            <p className="mb-2">(no actions match)</p>
            <p className="text-muted-foreground/70">
              Once an agent (or you) does anything, it shows up here in real time.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
            {filtered.map((a) => (
              <ActionRow key={a.id} a={a} />
            ))}
          </div>
        )}
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
    <Button
      asChild
      size="sm"
      variant={active ? "default" : "outline"}
      className="rounded-[var(--radius-2)] font-mono text-xs"
    >
      <Link href={href}>{label}</Link>
    </Button>
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
