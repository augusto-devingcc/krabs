import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTags } from "../../../../src/domain/tag.js";
import { EntityHeader } from "@/components/EntityTable";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listTags(ctx);

  return (
    <div className="p-8 max-w-4xl">
      <EntityHeader
        title="tags"
        description="Flat labels you can attach to contacts. Use them however makes sense — warm-lead, vip, panama, do-not-contact, whatever."
        count={items.length}
        examplePrompt='"Create a tag called warm-lead, color #4ade80."'
      />

      {items.length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {items.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-3 py-1 text-sm"
            >
              {t.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: t.color }}
                />
              )}
              <span>{t.name}</span>
              <span className="font-mono text-[10px] text-[var(--color-fg-faint)]">
                {t.id.slice(0, 8)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
