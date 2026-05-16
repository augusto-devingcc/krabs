import { Tag, Tags as TagsIcon, Hash, Palette } from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTags } from "../../../../src/domain/tag.js";
import { EntityHeader, EntityEmpty } from "@/components/EntityTable";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listTags(ctx);

  return (
    <div className="p-8 max-w-5xl">
      <EntityHeader
        icon={TagsIcon}
        title="tags"
        description="Flat labels you can attach to contacts. Use them however makes sense — warm-lead, vip, panama, do-not-contact, whatever."
        count={items.length}
      />

      {items.length === 0 ? (
        <EntityEmpty
          icon={Tag}
          description="No tags yet. Group contacts by anything — lifecycle stage, source, region — and reference them in agent prompts."
          prompt='Create a tag called warm-lead, color #4ade80.'
        />
      ) : (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Palette size={14} aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-wider">
                {items.length} labels
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((t) => (
                <Badge
                  key={t.id}
                  variant="outline"
                  className="text-sm py-1 pl-2 pr-3 gap-2 rounded-full"
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block shrink-0"
                    style={{
                      backgroundColor: t.color || "var(--muted-foreground)",
                    }}
                    aria-hidden
                  />
                  <span className="text-foreground">{t.name}</span>
                  <span className="inline-flex items-center gap-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Hash size={12} aria-hidden />
                    {t.id.slice(0, 6)}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
