import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listDeals } from "../../../../src/domain/deal.js";
import {
  EntityHeader,
  EntityEmpty,
  Table,
  Th,
  Td,
  Tr,
  StatusPill,
} from "@/components/EntityTable";

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
      />

      {items.length === 0 ? (
        <EntityEmpty
          description="No deals yet. Open one with a single message — your agent will pick the stage, value, and links."
          prompt='Open a deal with Acme Corp for $50k annual contract, stage proposal.'
        />
      ) : (
        <>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-faint)] mb-3">
            no drag-and-drop yet — ask your agent to move stages.
          </p>

          {/* Kanban board */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
            {stages.map((stage) => {
              const col = byStage.get(stage) ?? [];
              return (
                <div
                  key={stage}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 min-h-[180px] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-border)]">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg)]">
                      {stage}
                    </p>
                    <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg-muted)]">
                      {col.length}
                    </span>
                  </div>
                  <div className="space-y-2 flex-1">
                    {col.map((d) => (
                      <div
                        key={d.id}
                        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 text-sm hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
                      >
                        <p
                          className="font-mono text-sm font-medium mb-2 truncate text-[var(--color-fg)]"
                          title={d.title}
                        >
                          {d.title}
                        </p>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-mono text-[var(--color-fg-muted)]">
                            {d.value
                              ? `${d.value.toLocaleString()} ${d.currency ?? ""}`.trim()
                              : "—"}
                          </span>
                          <StatusPill status={d.status} tone="muted" />
                        </div>
                      </div>
                    ))}
                    {col.length === 0 && (
                      <p className="font-mono text-[11px] text-[var(--color-fg-faint)] italic px-1 py-2">
                        empty
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-faint)] mb-3">
            # all deals
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
                <Tr key={d.id}>
                  <Td mono faint>{d.id.slice(0, 12)}…</Td>
                  <Td>{d.title}</Td>
                  <Td>
                    <StatusPill status={d.stage} tone="strong" />
                  </Td>
                  <Td>
                    <StatusPill status={d.status} />
                  </Td>
                  <Td mono muted>
                    {d.value
                      ? `${d.value.toLocaleString()} ${d.currency ?? ""}`.trim()
                      : "—"}
                  </Td>
                  <Td mono faint>{d.expectedCloseDate ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
