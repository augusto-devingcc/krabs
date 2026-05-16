import { BadgeDollarSign, Info, Trophy, Layers, Target } from "lucide-react";
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        icon={BadgeDollarSign}
        title="deals"
        description="Revenue opportunities. Move them through stages — your agent can update fields conversationally."
        count={items.length}
      />

      {items.length === 0 ? (
        <EntityEmpty
          icon={Target}
          description="No deals yet. Open one with a single message — your agent will pick the stage, value, and links."
          prompt='Open a deal with Acme Corp for $50k annual contract, stage proposal.'
        />
      ) : (
        <>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
            <Info size={14} aria-hidden />
            no drag-and-drop yet — ask your agent to move stages.
          </p>

          {/* Kanban board */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
            {stages.map((stage) => {
              const col = byStage.get(stage) ?? [];
              return (
                <Card key={stage} className="min-h-[180px] py-3 gap-3">
                  <CardHeader className="px-3 pb-2 border-b grid-cols-[1fr_auto]">
                    <CardTitle className="font-mono text-[11px] uppercase tracking-wider">
                      {stage}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {col.length}
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-3 flex-1 space-y-2">
                    {col.map((d) => (
                      <Card
                        key={d.id}
                        className="py-2 gap-1 shadow-none bg-muted/40 hover:bg-muted transition-colors"
                      >
                        <CardContent className="px-3">
                          <p
                            className="font-mono text-sm font-medium truncate text-foreground"
                            title={d.title}
                          >
                            {d.title}
                          </p>
                        </CardContent>
                        <CardFooter className="px-3 justify-between text-[11px]">
                          <span className="font-mono text-muted-foreground">
                            {d.value
                              ? `${d.value.toLocaleString()} ${d.currency ?? ""}`.trim()
                              : "—"}
                          </span>
                          <StatusPill status={d.status} variant="outline" />
                        </CardFooter>
                      </Card>
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

          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
            <Layers size={14} aria-hidden /> all deals
          </p>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                  <TableHead>title</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5">
                      <Trophy size={14} aria-hidden /> stage
                    </span>
                  </TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>value</TableHead>
                  <TableHead>close date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.id.slice(0, 12)}…
                    </TableCell>
                    <TableCell>{d.title}</TableCell>
                    <TableCell>
                      <StatusPill status={d.stage} variant="default" />
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
          </div>
        </>
      )}
    </div>
  );
}
