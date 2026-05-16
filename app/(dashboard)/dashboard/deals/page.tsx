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
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STAGES = ["new", "qualified", "proposal", "negotiation", "closed"] as const;

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
          <p className="k-eyebrow mb-3">
            no drag-and-drop yet — ask your agent to move stages.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
            {stages.map((stage) => {
              const col = byStage.get(stage) ?? [];
              return (
                <Card
                  key={stage}
                  className="min-h-[180px] py-3 gap-3 border-border rounded-xl"
                >
                  <CardHeader className="px-3 pb-2 border-b border-border grid-cols-[1fr_auto]">
                    <span className="k-eyebrow">{stage}</span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {col.length}
                    </span>
                  </CardHeader>
                  <CardContent className="gap-2 px-3 flex-1">
                    {col.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-md border border-border bg-background px-3 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <p
                          className="text-sm font-medium truncate text-foreground"
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
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="k-eyebrow mb-3">all deals</p>
          <Card
            className="overflow-hidden p-0 gap-0 border-border rounded-xl"
            style={{ boxShadow: "var(--shadow-1)" }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="k-eyebrow font-medium">id</TableHead>
                  <TableHead className="k-eyebrow font-medium">title</TableHead>
                  <TableHead className="k-eyebrow font-medium">stage</TableHead>
                  <TableHead className="k-eyebrow font-medium">status</TableHead>
                  <TableHead className="k-eyebrow font-medium">value</TableHead>
                  <TableHead className="k-eyebrow font-medium">
                    close date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.id.slice(0, 12)}…
                    </TableCell>
                    <TableCell className="text-sm">{d.title}</TableCell>
                    <TableCell>
                      <StatusPill status={d.stage} pillTone="accent" />
                    </TableCell>
                    <TableCell>
                      <StatusPill status={d.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.value
                        ? `${d.value.toLocaleString()} ${d.currency ?? ""}`.trim()
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.expectedCloseDate ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
