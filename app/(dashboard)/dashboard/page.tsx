import Link from "next/link";
import {
  Activity,
  ArrowRight,
  AtSign,
  BadgeDollarSign,
  CheckSquare,
  History,
  KeyRound,
  MessageSquare,
  StickyNote,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
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
      {/* Page header */}
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-2">
        # overview
      </p>
      <h1 className="text-3xl font-medium tracking-tight mb-2">
        Welcome{clerkName ? `, ${clerkName}` : ""}.
      </h1>
      <p className="text-muted-foreground mb-10 max-w-2xl">
        socrm is operated by your agents. This page summarises what they&apos;ve
        done.
      </p>

      {/* Empty-state: connect your first agent */}
      {isEmpty && (
        <Card
          className="mb-10 border-foreground"
          aria-labelledby="connect-agent-heading"
        >
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <KeyRound
                aria-hidden
                size={20}
                className="text-foreground"
              />
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  # get started
                </p>
                <h2
                  id="connect-agent-heading"
                  className="text-xl font-medium tracking-tight leading-none"
                >
                  Connect your first agent.
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-5 max-w-xl">
              socrm is operated by agents, not humans. Three steps and your CLI,
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

      {/* Primary counts row */}
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-3">
        # entities
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatPrimary
          href="/dashboard/contacts"
          label="contacts"
          n={counts.contacts}
          icon={Users}
        />
        <StatPrimary
          href="/dashboard/deals"
          label="deals"
          n={counts.deals}
          icon={BadgeDollarSign}
        />
        <StatPrimary
          href="/dashboard/tasks"
          label="tasks"
          n={counts.tasks}
          icon={CheckSquare}
        />
        <StatPrimary
          href="/dashboard/notes"
          label="notes"
          n={counts.notes}
          icon={StickyNote}
        />
      </div>

      {/* Secondary counts row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-12">
        <StatCompact
          href="/dashboard/tags"
          label="tags"
          n={counts.tags}
          icon={Tag}
        />
        <StatCompact
          href="/dashboard/contacts"
          label="identities"
          n={counts.identities}
          icon={AtSign}
        />
        <StatCompact
          label="interactions"
          n={counts.interactions}
          icon={MessageSquare}
        />
        <StatCompact
          href="/dashboard/audit"
          label="actions"
          n={counts.actions}
          icon={History}
        />
        <StatCompact
          href="/dashboard/keys"
          label="api keys"
          n={counts.apiKeys}
          icon={KeyRound}
        />
      </div>

      {/* Recent activity, terminal-style inside a card */}
      <Card className="py-0 gap-0 mb-10 overflow-hidden">
        <CardHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity
                aria-hidden
                size={16}
                className="text-muted-foreground"
              />
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                recent activity
              </span>
            </div>
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
            <div className="px-4 py-8 text-center text-muted-foreground">
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
                    className="px-4 py-2 grid grid-cols-[64px_minmax(0,180px)_minmax(0,1fr)_auto] gap-3 items-baseline"
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

      {/* Account id, muted, bottom — with tooltip */}
      <AccountIdTooltip accountId={account.id} />
    </div>
  );
}

function StatPrimary({
  href,
  label,
  n,
  icon: Icon,
}: {
  href?: string;
  label: string;
  n: number;
  icon: LucideIcon;
}) {
  const card = (
    <Card
      className={`py-0 gap-0 transition-colors ${
        href ? "hover:bg-accent/50 cursor-pointer" : ""
      }`}
    >
      <CardHeader className="px-5 pt-5 pb-1">
        <div className="flex items-center gap-2">
          <Icon
            aria-hidden
            size={14}
            className="text-muted-foreground"
          />
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
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
  icon: Icon,
}: {
  href?: string;
  label: string;
  n: number;
  icon: LucideIcon;
}) {
  const card = (
    <Card
      className={`py-0 gap-0 transition-colors ${
        href ? "hover:bg-accent/50 cursor-pointer" : ""
      }`}
    >
      <CardHeader className="px-4 pt-3 pb-0.5">
        <div className="flex items-center gap-1.5">
          <Icon
            aria-hidden
            size={12}
            className="text-muted-foreground"
          />
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
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
