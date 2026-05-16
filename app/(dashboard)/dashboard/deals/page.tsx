import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listDeals } from "../../../../src/domain/deal.js";
import { EntityHeader, Table, Th, Td, StatusPill } from "@/components/EntityTable";

export const dynamic = "force-dynamic";

const STAGES = ["new", "qualified", "proposal", "negotiation", "closed"] as const;

export default async function DealsPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listDeals(ctx, { limit: 200 });

  // Group by stage for the kanban view
  const byStage = new Map<string, typeof items>();
  for (const d of items) {
    if (!byStage.has(d.stage)) byStage.set(d.stage, []);
    byStage.get(d.stage)!.push(d);
  }
  const stages = Array.from(new Set([...STAGES, ...byStage.keys()]));

  return (
    <div className="p-8 max-w-7xl">
      <EntityHeader
        title="deals"
        description="Revenue opportunities. Move them through stages — your agent can update fields conversationally."
        count={items.length}
        examplePrompt='"Open a deal with Acme Corp for $50k annual contract, stage proposal."'
      />

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
        {stages.map((stage) => {
          const col = byStage.get(stage) ?? [];
          return (
            <div key={stage} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 min-h-[160px]">
              <div className="flex items-baseline justify-between mb-3">
                <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)]">
                  {stage}
                </p>
                <span className="font-mono text-xs text-[var(--color-fg-faint)]">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((d) => (
                  <div
                    key={d.id}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 text-sm"
                  >
                    <p className="font-medium mb-1 truncate" title={d.title}>{d.title}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-[var(--color-fg-muted)]">
                        {d.value ? `${d.value.toLocaleString()} ${d.currency ?? ""}` : "—"}
                      </span>
                      <StatusPill status={d.status} />
                    </div>
                  </div>
                ))}
                {col.length === 0 && (
                  <p className="text-xs text-[var(--color-fg-faint)] italic">empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <>
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
            # all deals (flat view)
          </p>
          <Table>
            <thead>
              <tr>
                <Th>id</Th>
                <Th>title</Th>
                <Th>stage</Th>
                <Th>status</Th>
                <Th>value</Th>
                <Th>close date</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t border-[var(--color-border)]">
                  <Td mono muted>{d.id.slice(0, 12)}…</Td>
                  <Td>{d.title}</Td>
                  <Td><StatusPill status={d.stage} /></Td>
                  <Td><StatusPill status={d.status} /></Td>
                  <Td mono>{d.value ? `${d.value.toLocaleString()} ${d.currency ?? ""}` : "—"}</Td>
                  <Td muted>{d.expectedCloseDate ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
