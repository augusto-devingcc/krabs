import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listNotes } from "../../../../src/domain/note.js";
import { EntityHeader, EntityEmpty } from "@/components/EntityTable";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listNotes(ctx, { limit: 50 });

  return (
    <div className="p-8 max-w-5xl">
      <EntityHeader
        title="notes"
        description="Free-form scratchpad. Markdown-ish. Tied to a contact or deal optionally — your agent often writes meeting notes here."
        count={items.length}
      />

      {items.length === 0 ? (
        <EntityEmpty
          description="No notes yet. Capture meeting context, decisions, or anything worth remembering — agents read these."
          prompt='Take a note on Acme deal: Decision-maker is Pedro; budget signed off; demo next Wed.'
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((n) => (
            <article
              key={n.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 flex flex-col gap-4 hover:border-[var(--color-border-strong)] transition-colors"
            >
              <header className="flex items-center justify-between gap-3 text-[11px] font-mono">
                <span className="text-[var(--color-fg-faint)] uppercase tracking-wider">
                  {n.id.slice(0, 10)}…
                </span>
                <span className="text-[var(--color-fg-faint)]">
                  {rel(n.createdAt)}
                </span>
              </header>

              {n.title && (
                <h3 className="text-xl font-medium tracking-tight text-[var(--color-fg)] leading-snug">
                  {n.title}
                </h3>
              )}

              <div className="relative">
                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-[var(--color-fg-muted)] max-h-56 overflow-hidden">
                  {n.body}
                </pre>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent, var(--color-surface))",
                  }}
                />
              </div>

              {(n.contactId || n.dealId) && (
                <footer className="mt-auto pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-2 text-[11px] font-mono">
                  {n.contactId && (
                    <a
                      href={`/dashboard/contacts?q=${encodeURIComponent(n.contactId)}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
                    >
                      <span className="text-[var(--color-fg-faint)]">contact</span>
                      <span>{n.contactId.slice(0, 10)}…</span>
                    </a>
                  )}
                  {n.dealId && (
                    <a
                      href={`/dashboard/deals`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
                    >
                      <span className="text-[var(--color-fg-faint)]">deal</span>
                      <span>{n.dealId.slice(0, 10)}…</span>
                    </a>
                  )}
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 86_400_000 * 30) return `${Math.floor(diff / 86_400_000)}d ago`;
  return iso.slice(0, 10);
}
