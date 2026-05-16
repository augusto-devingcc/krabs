import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTags } from "../../../../src/domain/tag.js";
import { EntityHeader, EntityEmpty } from "@/components/EntityTable";

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
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <div className="flex flex-wrap gap-2">
            {items.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full pl-2.5 pr-3 py-1 text-sm hover:border-[var(--color-border-strong)] transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{
                    backgroundColor: t.color || "var(--color-fg-faint)",
                  }}
                  aria-hidden
                />
                <span className="text-[var(--color-fg)]">{t.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)]">
                  {t.id.slice(0, 6)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
