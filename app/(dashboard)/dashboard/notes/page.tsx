import NextLink from "next/link";
import { StickyNote, Link as LinkIcon, User, Briefcase } from "lucide-react";
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
        icon={StickyNote}
        title="notes"
        description="Free-form scratchpad. Markdown-ish. Tied to a contact or deal optionally — your agent often writes meeting notes here."
        count={items.length}
      />

      {items.length === 0 ? (
        <EntityEmpty
          icon={StickyNote}
          description="No notes yet. Capture meeting context, decisions, or anything worth remembering — agents read these."
          prompt='Take a note on Acme deal: Decision-maker is Pedro; budget signed off; demo next Wed.'
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((n) => (
            <Card key={n.id} className="hover:border-foreground/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between gap-3 text-[11px] font-mono">
                <span className="text-muted-foreground uppercase tracking-wider">
                  {n.id.slice(0, 10)}…
                </span>
                <time className="text-muted-foreground font-mono text-[11px]">
                  {rel(n.createdAt)}
                </time>
              </CardHeader>

              {n.title && (
                <CardContent>
                  <CardTitle className="text-xl font-medium tracking-tight leading-snug">
                    {n.title}
                  </CardTitle>
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
                <CardFooter className="border-t pt-6 flex flex-wrap gap-2 text-[11px] font-mono">
                  {n.contactId && (
                    <NextLink
                      href={`/dashboard/contacts?q=${encodeURIComponent(n.contactId)}`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >
                      <LinkIcon size={14} aria-hidden />
                      <User size={14} aria-hidden />
                      <span>{n.contactId.slice(0, 10)}…</span>
                    </NextLink>
                  )}
                  {n.dealId && (
                    <NextLink
                      href={`/dashboard/deals`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >
                      <LinkIcon size={14} aria-hidden />
                      <Briefcase size={14} aria-hidden />
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
