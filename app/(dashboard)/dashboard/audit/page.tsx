import Link from "next/link";
import { Activity, History, X } from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listActions } from "../../../../src/domain/contact.js";
import { reversibilityOf } from "../../../../src/domain/action.js";
import { ActionRow, type AuditRow } from "./ActionRow";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-2">
        # audit log
      </p>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-medium">What your agents did</h1>
        <History size={24} className="text-muted-foreground" aria-hidden />
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">
        Every mutation — by you, the CLI, the MCP, or any of your agents — is here. Reversible
        ones can be undone with one click. Undoing is itself logged.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
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
          <Button
            key={c.label}
            asChild
            variant="outline"
            size="sm"
            className="rounded-full"
          >
            <Link href={c.clearHref}>
              <span>{c.label}</span>
              <X size={14} aria-hidden className="text-muted-foreground" />
            </Link>
          </Button>
        ))}
      </div>

      <Card className="p-0 gap-0 overflow-hidden font-mono text-xs">
        <CardHeader className="bg-muted px-4 py-2 border-b flex flex-row items-center gap-3">
          <Activity size={16} className="text-muted-foreground" aria-hidden />
          <span className="text-foreground">$ socrm action list</span>
          <Badge variant="outline" className="ml-auto">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </Badge>
        </CardHeader>
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-3">(no actions match)</p>
              <p className="text-muted-foreground/70">
                Once an agent (or you) does anything, it shows up here in real time.
              </p>
            </div>
          ) : (
            filtered.map((a) => <ActionRow key={a.id} a={a} />)
          )}
        </div>
      </Card>
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
      className="rounded-full font-mono text-xs"
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
