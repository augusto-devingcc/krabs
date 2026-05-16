import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTags } from "../../../../src/domain/tag.js";
import { EntityHeader, EntityEmpty } from "@/components/EntityTable";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listTags(ctx);

  return (
    <div className="p-8 max-w-5xl">
      <EntityHeader
        title="tags"
        description="Flat labels you can attach to contacts. Use them however makes sense — warm-lead, vip, panama, do-not-contact, whatever."
        count={items.length}
      />

      {items.length === 0 ? (
        <EntityEmpty
          description="No tags yet. Group contacts by anything — lifecycle stage, source, region — and reference them in agent prompts."
          prompt='Create a tag called warm-lead, color #4ade80.'
        />
      ) : (
        <Card
          className="border-border rounded-xl"
          style={{ boxShadow: "var(--shadow-1)" }}
        >
          <CardContent>
            <p className="k-eyebrow mb-3">{items.length} labels</p>
            <div className="flex flex-wrap gap-2">
              {items.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-sm"
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block shrink-0"
                    style={{
                      backgroundColor: t.color || "var(--muted-foreground)",
                    }}
                    aria-hidden
                  />
                  <span className="text-foreground">{t.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {t.id.slice(0, 6)}
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
