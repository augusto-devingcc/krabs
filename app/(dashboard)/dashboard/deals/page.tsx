import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listDeals } from "../../../../src/domain/deal.js";
import {
  EntityHeader,
  EntityEmpty,
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  StatusPill,
} from "@/components/EntityTable";

export const dynamic = "force-dynamic";

const STAGES = ["new", "qualified", "proposal", "negotiation", "closed"] as const;

// Stage → color dot (matches designer's DealsTable: neutral/info/warning/success).
const STAGE_DOT: Record<string, string> = {
  new: "var(--neutral-400)",
  qualified: "var(--info-500)",
  proposal: "var(--warning-500)",
  negotiation: "var(--warning-500)",
  closed: "var(--success-500)",
};

export default async function DealsPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listDeals(ctx, { limit: 200 });

  const byStage = new Map<string, typeof items>();
  for (const d of items) {
    if (!byStage.has(d.stage)) byStage.set(d.stage, []);
    byStage.get(d.stage)!.push(d);
  }
  const stages = Array.from(new Set([...STAGES, ...byStage.keys()]));

  return (
    <div className="center">
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
          {/* Kanban by stage — minimalist Linear-style cards. No drag-and-drop;
              agents move stages. */}
          <p className="k-eyebrow mb-3">
            no drag-and-drop yet — ask your agent to move stages.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-10">
            {stages.map((stage) => {
              const col = byStage.get(stage) ?? [];
              return (
                <div
                  key={stage}
                  className="border border-border-light rounded-md bg-card min-h-[180px]"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2 border-b"
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <span className="k-eyebrow">{stage}</span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {col.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    {col.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-[var(--radius-2)] border bg-background px-3 py-2 hover:bg-muted/50 transition-colors"
                        style={{ borderColor: "var(--border-light)" }}
                      >
                        <p
                          className="text-sm truncate text-foreground"
                          title={d.title}
                        >
                          {d.title}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                          <span className="truncate">
                            {d.value
                              ? `${d.value.toLocaleString()} ${d.currency ?? ""}`.trim()
                              : "—"}
                          </span>
                          <StatusPill status={d.status} />
                        </div>
                      </div>
                    ))}
                    {col.length === 0 && (
                      <p className="text-muted-foreground italic font-mono text-[11px] px-1 py-2">
                        empty
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full list — exact designer DealsTable pattern */}
          <p className="k-eyebrow mb-3">all deals</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>name</TableHead>
                <TableHead style={{ width: 140 }}>stage</TableHead>
                <TableHead style={{ width: 120 }}>status</TableHead>
                <TableHead style={{ width: 120, textAlign: "right" }}>value</TableHead>
                <TableHead style={{ width: 120, textAlign: "right" }}>close date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="dt-name-l">{d.title}</TableCell>
                  <TableCell>
                    <span className="dt-stage">
                      <span
                        className="dt-stage-dot"
                        style={{ background: STAGE_DOT[d.stage] ?? "var(--neutral-400)" }}
                      />
                      {d.stage}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={d.status} />
                  </TableCell>
                  <TableCell className="dt-value">
                    {d.value
                      ? `$${d.value.toLocaleString()}${d.currency && d.currency !== "USD" ? ` ${d.currency}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="dt-updated">
                    {d.expectedCloseDate ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
