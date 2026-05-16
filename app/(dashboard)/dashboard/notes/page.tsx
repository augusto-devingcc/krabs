import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listNotes } from "../../../../src/domain/note.js";
import { EntityHeader } from "@/components/EntityTable";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listNotes(ctx, { limit: 50 });

  return (
    <div className="p-8 max-w-4xl">
      <EntityHeader
        title="notes"
        description="Free-form scratchpad. Markdown-ish. Tied to a contact or deal optionally — your agent often writes meeting notes here."
        count={items.length}
        examplePrompt='"Take a note on Acme deal: Decision-maker is Pedro; budget signed off; demo next Wed."'
      />

      {items.length === 0 ? null : (
        <div className="space-y-3">
          {items.map((n) => (
            <article
              key={n.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5"
            >
              <header className="flex items-center justify-between mb-2 text-xs">
                <p className="font-mono text-[var(--color-fg-muted)]">
                  {n.id.slice(0, 12)}…
                </p>
                <p className="font-mono text-[var(--color-fg-faint)]">
                  {n.createdAt.slice(0, 10)}
                </p>
              </header>
              {n.title && (
                <h3 className="font-medium mb-2">{n.title}</h3>
              )}
              <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-[var(--color-fg)]">
                {n.body}
              </pre>
              {(n.contactId || n.dealId) && (
                <footer className="mt-3 pt-3 border-t border-[var(--color-border)] flex gap-3 text-xs font-mono text-[var(--color-fg-muted)]">
                  {n.contactId && <span>contact: {n.contactId.slice(0, 16)}…</span>}
                  {n.dealId && <span>deal: {n.dealId.slice(0, 16)}…</span>}
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
