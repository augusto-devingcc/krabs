import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDashboardContext } from "../../../src/lib/web/dashboard-ctx.js";
import { listActions } from "../../../src/domain/contact.js";
import { getAccountCounts } from "../../../src/domain/counts.js";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
    <div className="p-8 max-w-6xl">
      <div className="mb-10">
        <p className="k-eyebrow mb-2">crm · overview</p>
        <h1 className="k-h2 mb-2">
          Welcome{clerkName ? `, ${clerkName}` : ""}.
        </h1>
        <p className="k-body-sm text-muted-foreground max-w-2xl">
          krabs is operated by your agents. This page summarises what they&apos;ve
          done.
        </p>
      </div>

      {isEmpty && (
        <Card
          className="mb-10 border-border rounded-xl"
          style={{ boxShadow: "var(--shadow-1)" }}
          aria-labelledby="connect-agent-heading"
        >
          <CardHeader>
            <p className="k-eyebrow mb-1">get started</p>
            <h2 id="connect-agent-heading" className="k-h3">
              Connect your first agent.
            </h2>
          </CardHeader>
          <CardContent>
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
                  <span className="font-mono text-[11px] inline-flex items-center justify-center w-5 h-5 shrink-0 rounded border border-border bg-muted text-muted-foreground">
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
          </CardContent>
        </Card>
      )}

      <p className="k-eyebrow mb-3">entities</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatPrimary
          href="/dashboard/contacts"
          label="contacts"
          n={counts.contacts}
        />
        <StatPrimary
          href="/dashboard/deals"
          label="deals"
          n={counts.deals}
        />
        <StatPrimary
          href="/dashboard/tasks"
          label="tasks"
          n={counts.tasks}
        />
        <StatPrimary
          href="/dashboard/notes"
          label="notes"
          n={counts.notes}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-12">
        <StatCompact href="/dashboard/tags" label="tags" n={counts.tags} />
        <StatCompact
          href="/dashboard/contacts"
          label="identities"
          n={counts.identities}
        />
        <StatCompact label="interactions" n={counts.interactions} />
        <StatCompact
          href="/dashboard/audit"
          label="actions"
          n={counts.actions}
        />
        <StatCompact
          href="/dashboard/keys"
          label="api keys"
          n={counts.apiKeys}
        />
      </div>

      <Card
        className="py-0 gap-0 mb-10 overflow-hidden border-border rounded-xl"
        style={{ boxShadow: "var(--shadow-1)" }}
      >
        <CardHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <span className="k-eyebrow">recent activity</span>
            <Link
              href="/dashboard/audit"
              className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              audit log
              <ArrowRight aria-hidden size={12} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0 font-mono text-xs">
          {recent.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted-foreground">
              (no activity yet — your agents will fill this column)
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => {
                const time = a.createdAt.slice(11, 19);
                const via = a.apiKeyId ? a.apiKeyId.slice(0, 8) : "—";
                return (
                  <li
                    key={a.id}
                    className="px-4 py-2 grid grid-cols-[64px_minmax(0,180px)_minmax(0,1fr)_auto] gap-3 items-baseline hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-muted-foreground">{time}</span>
                    <span className="text-foreground truncate">
                      {a.operation}
                    </span>
                    <span className="text-muted-foreground italic truncate">
                      {a.intent ?? (
                        <span className="not-italic text-muted-foreground/60">
                          —
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground/70 whitespace-nowrap">
                      via {via}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AccountIdTooltip accountId={account.id} />
    </div>
  );
}

function StatPrimary({
  href,
  label,
  n,
}: {
  href?: string;
  label: string;
  n: number;
}) {
  const card = (
    <Card
      className={`py-0 gap-0 border-border rounded-xl transition-colors ${
        href ? "hover:bg-muted/50 cursor-pointer" : ""
      }`}
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <CardHeader className="px-5 pt-5 pb-1">
        <p className="k-eyebrow">{label}</p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className="text-3xl font-medium tabular-nums tracking-tight text-foreground">
          {n}
        </p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

function StatCompact({
  href,
  label,
  n,
}: {
  href?: string;
  label: string;
  n: number;
}) {
  const card = (
    <Card
      className={`py-0 gap-0 border-border rounded-xl transition-colors ${
        href ? "hover:bg-muted/50 cursor-pointer" : ""
      }`}
    >
      <CardHeader className="px-4 pt-3 pb-0.5">
        <p className="k-eyebrow">{label}</p>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <p className="text-lg font-medium tabular-nums text-muted-foreground">
          {n}
        </p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

