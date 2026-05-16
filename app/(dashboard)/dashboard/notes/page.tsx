import NextLink from "next/link";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listNotes } from "../../../../src/domain/note.js";
import { EntityHeader, EntityEmpty } from "@/components/EntityTable";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((n) => (
            <Card
              key={n.id}
              className="border-border rounded-xl transition-colors hover:bg-muted/30"
              style={{ boxShadow: "var(--shadow-1)" }}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {n.id.slice(0, 10)}…
                </span>
                <time className="font-mono text-xs text-muted-foreground">
                  {rel(n.createdAt)}
                </time>
              </CardHeader>

              {n.title && (
                <CardContent>
                  <CardTitle className="k-h4 leading-snug">{n.title}</CardTitle>
                </CardContent>
              )}

              <CardContent>
                <div className="relative">
                  <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-muted-foreground max-h-56 overflow-hidden">
                    {n.body}
                  </pre>
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
                    style={{
                      background:
                        "linear-gradient(to bottom, transparent, var(--card))",
                    }}
                  />
                </div>
              </CardContent>

              {(n.contactId || n.dealId) && (
                <CardFooter className="border-t border-border pt-4 flex flex-wrap gap-2">
                  {n.contactId && (
                    <NextLink
                      href={`/dashboard/contacts?q=${encodeURIComponent(n.contactId)}`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-muted font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    >
                      <span>contact</span>
                      <span>·</span>
                      <span>{n.contactId.slice(0, 10)}…</span>
                    </NextLink>
                  )}
                  {n.dealId && (
                    <NextLink
                      href={`/dashboard/deals`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-muted font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    >
                      <span>deal</span>
                      <span>·</span>
                      <span>{n.dealId.slice(0, 10)}…</span>
                    </NextLink>
                  )}
                </CardFooter>
              )}
            </Card>
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
