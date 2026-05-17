import NextLink from "next/link";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listNotes } from "../../../../src/domain/note.js";
import { EntityHeader, EntityEmpty } from "@/components/EntityTable";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const { ctx } = await getDashboardContext();
  const { items } = await listNotes(ctx, { limit: 50 });

  return (
    <div className="center">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((n) => (
            <article
              key={n.id}
              className="border rounded-[var(--radius-4)] bg-card p-4 flex flex-col gap-3 transition-colors hover:bg-muted/30"
              style={{ borderColor: "var(--border-light)" }}
            >
              <header className="flex items-center justify-between gap-3 -mb-1">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {n.id.slice(0, 10)}…
                </span>
                <time className="font-mono text-[11px] text-muted-foreground">
                  {rel(n.createdAt)}
                </time>
              </header>

              {n.title && (
                <h3 className="text-base font-semibold leading-snug tracking-tight">
                  {n.title}
                </h3>
              )}

              <div className="relative">
                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-muted-foreground max-h-56 overflow-hidden">
                  {n.body}
                </pre>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent, var(--card))",
                  }}
                />
              </div>

              {(n.contactId || n.dealId) && (
                <footer
                  className="border-t pt-3 flex flex-wrap gap-2"
                  style={{ borderColor: "var(--border-muted)" }}
                >
                  {n.contactId && (
                    <NextLink
                      href={`/dashboard/contacts?q=${encodeURIComponent(n.contactId)}`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-2)] border bg-muted font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                      style={{ borderColor: "var(--border-light)" }}
                    >
                      <span>contact</span>
                      <span>·</span>
                      <span>{n.contactId.slice(0, 10)}…</span>
                    </NextLink>
                  )}
                  {n.dealId && (
                    <NextLink
                      href={`/dashboard/deals`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-2)] border bg-muted font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                      style={{ borderColor: "var(--border-light)" }}
                    >
                      <span>deal</span>
                      <span>·</span>
                      <span>{n.dealId.slice(0, 10)}…</span>
                    </NextLink>
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
