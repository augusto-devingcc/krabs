import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDashboardContext } from "../../../src/lib/web/dashboard-ctx.js";
import { listActions } from "../../../src/domain/contact.js";
import { getAccountCounts } from "../../../src/domain/counts.js";
import { Button } from "@/components/ui/button";
import { AccountIdTooltip } from "./account-id-tooltip";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const { ctx, account, clerkName } = await getDashboardContext();
  const [counts, recent] = await Promise.all([
    getAccountCounts(ctx),
    listActions(ctx, { limit: 8 }),
  ]);

  const totalEntities =
    counts.contacts + counts.deals + counts.tasks + counts.notes;
  const isEmpty = totalEntities === 0;

  return (
    <div className="center">
      {/* Page intro — same level as .center__head but personalized. */}
      <div className="mb-8">
        <p className="k-eyebrow mb-2">crm · overview</p>
        <h1 className="center__h">
          Welcome{clerkName ? `, ${clerkName}` : ""}.
        </h1>
        <p className="k-body-sm text-muted-foreground max-w-2xl mt-2">
          krabs is operated by your agents. This page summarises what they&apos;ve
          done.
        </p>
      </div>

      {isEmpty && (
        <div
          className="mb-10 border rounded-[var(--radius-4)] bg-card p-6"
          style={{ borderColor: "var(--border-light)", boxShadow: "var(--shadow-1)" }}
        >
          <p className="k-eyebrow mb-1">get started</p>
          <h2 className="text-lg font-semibold mb-2 tracking-tight">
            Connect your first agent.
          </h2>
          <p className="k-body-sm text-muted-foreground mb-5 max-w-xl">
            krabs is operated by agents, not humans. Three steps and your CLI,
            Claude Desktop, or Cursor can read and write here directly.
          </p>
          <ol className="flex flex-col gap-2 mb-6 text-sm">
            {[
              "Generate an API key from the keys page.",
              "Paste it into Claude Desktop, Cursor, or your CLI as an MCP server.",
              "Issue a command — the audit log will show it here within seconds.",
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-3 items-baseline text-foreground"
              >
                <span
                  className="font-mono text-[11px] inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-[var(--radius-2)] border bg-muted text-muted-foreground"
                  style={{ borderColor: "var(--border-light)" }}
                >
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <Button asChild>
            <Link href="/dashboard/keys">
              Generate a key
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      )}

      {/* Stats — designer's .ag__summary horizontal bar (top + bottom rules,
          mono uppercase labels, display-size numbers). One row of 5 primary
          entities; secondary counts live below as a quiet sub-line. */}
      <div className="ag__summary mb-3">
        <Stat href="/dashboard/contacts" label="contacts" n={counts.contacts} />
        <Stat href="/dashboard/deals" label="deals" n={counts.deals} />
        <Stat href="/dashboard/tasks" label="tasks" n={counts.tasks} />
        <Stat href="/dashboard/notes" label="notes" n={counts.notes} />
        <Stat href="/dashboard/audit" label="actions" n={counts.actions} />
      </div>
      <p className="font-mono text-[11px] text-muted-foreground mb-10">
        {counts.identities.toLocaleString()} identities ·{" "}
        {counts.interactions.toLocaleString()} interactions ·{" "}
        {counts.tags.toLocaleString()} tags ·{" "}
        {counts.apiKeys.toLocaleString()} api keys
      </p>

      {/* Recent activity — designer's .rp__list pattern (grid: time / op / intent / via). */}
      <div className="mb-6 flex items-end justify-between">
        <h2 className="center__h" style={{ fontSize: "16px" }}>
          Recent activity
        </h2>
        <Link
          href="/dashboard/audit"
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          audit log
          <ArrowRight aria-hidden size={12} />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div
          className="border rounded-[var(--radius-3)] bg-card py-10 text-center text-muted-foreground"
          style={{ borderColor: "var(--border-light)" }}
        >
          (no activity yet — your agents will fill this column)
        </div>
      ) : (
        <div className="rp__list mb-10">
          {recent.map((a) => {
            const time = a.createdAt.slice(11, 19);
            const via = a.apiKeyId ? a.apiKeyId.slice(0, 8) : "—";
            return (
              <div className="rp__run" key={a.id}>
                <span className="rp__run-time">{time}</span>
                <span className="rp__run-tool">
                  <code>{a.operation}</code>
                </span>
                <span className="rp__run-agent">
                  {a.intent ? (
                    <span className="truncate" title={a.intent}>
                      {a.intent}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </span>
                <span className="rp__run-lat">via {via}</span>
              </div>
            );
          })}
        </div>
      )}

      <AccountIdTooltip accountId={account.id} />
    </div>
  );
}

function Stat({
  href,
  label,
  n,
}: {
  href?: string;
  label: string;
  n: number;
}) {
  const body = (
    <>
      <div className="ag__summary-k">{label}</div>
      <div className="ag__summary-v">{n.toLocaleString()}</div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="ag__summary-stat"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {body}
      </Link>
    );
  }
  return <div className="ag__summary-stat">{body}</div>;
}
