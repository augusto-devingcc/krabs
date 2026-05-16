import Link from "next/link";
import { getDashboardContext } from "../../../src/lib/web/dashboard-ctx.js";
import { listActions } from "../../../src/domain/contact.js";
import { getAccountCounts } from "../../../src/domain/counts.js";

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
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
        # overview
      </p>
      <h1 className="text-3xl font-medium tracking-tight mb-2">
        Welcome{clerkName ? `, ${clerkName}` : ""}.
      </h1>
      <p className="text-[var(--color-fg-muted)] mb-10 max-w-2xl">
        socrm is operated by your agents. This page summarises what they&apos;ve
        done.
      </p>

      {/* Empty-state: monochrome, loud, numbered */}
      {isEmpty && (
        <section
          className="mb-10 rounded-[var(--radius-md)] border border-[var(--color-fg)] bg-[var(--color-surface)] p-7"
          aria-labelledby="connect-agent-heading"
        >
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
            # get started
          </p>
          <h2
            id="connect-agent-heading"
            className="text-xl font-medium mb-2 tracking-tight"
          >
            Connect your first agent.
          </h2>
          <p className="text-sm text-[var(--color-fg-muted)] mb-5 max-w-xl">
            socrm is operated by agents, not humans. Three steps and your CLI,
            Claude Desktop, or Cursor can read and write here directly.
          </p>
          <ol className="space-y-2 mb-6 text-sm">
            {[
              "Generate an API key from the keys page.",
              "Paste it into Claude Desktop, Cursor, or your CLI as an MCP server.",
              "Issue a command — the audit log will show it here within seconds.",
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-3 items-baseline text-[var(--color-fg)]"
              >
                <span className="font-mono text-xs text-[var(--color-fg-faint)] w-5 shrink-0">
                  {i + 1}.
                </span>
                <span className="text-[var(--color-fg-muted)]">{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href="/dashboard/keys"
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)] transition-colors px-4 py-2 text-sm font-medium"
          >
            Generate a key
            <span aria-hidden>→</span>
          </Link>
        </section>
      )}

      {/* Primary counts row */}
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
        # entities
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatPrimary
          href="/dashboard/contacts"
          label="contacts"
          n={counts.contacts}
        />
        <StatPrimary href="/dashboard/deals" label="deals" n={counts.deals} />
        <StatPrimary href="/dashboard/tasks" label="tasks" n={counts.tasks} />
        <StatPrimary href="/dashboard/notes" label="notes" n={counts.notes} />
      </div>

      {/* Secondary counts row */}
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
        <StatCompact href="/dashboard/keys" label="api keys" n={counts.apiKeys} />
      </div>

      {/* Recent activity, terminal-style */}
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
        # recent activity
      </p>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden font-mono text-xs">
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--color-fg-muted)]">
            (no activity yet — your agents will fill this column)
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {recent.map((a) => {
              const time = a.createdAt.slice(11, 19);
              const via = a.apiKeyId ? a.apiKeyId.slice(0, 8) : "—";
              return (
                <li
                  key={a.id}
                  className="px-4 py-2 grid grid-cols-[64px_minmax(0,180px)_minmax(0,1fr)_auto] gap-3 items-baseline"
                >
                  <span className="text-[var(--color-fg-faint)]">{time}</span>
                  <span className="text-[var(--color-fg)] truncate">
                    {a.operation}
                  </span>
                  <span className="text-[var(--color-fg-muted)] italic truncate">
                    {a.intent ?? (
                      <span className="not-italic text-[var(--color-fg-faint)]">
                        —
                      </span>
                    )}
                  </span>
                  <span className="text-[var(--color-fg-faint)] whitespace-nowrap">
                    via {via}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="bg-[var(--color-surface-2)] border-t border-[var(--color-border)] px-4 py-2 text-[var(--color-fg-faint)]">
          <Link
            href="/dashboard/audit"
            className="hover:text-[var(--color-fg)] transition-colors"
          >
            see full audit log →
          </Link>
        </div>
      </div>

      {/* Account id, muted, bottom */}
      <p className="mt-10 text-xs text-[var(--color-fg-faint)] font-mono">
        account: <span className="text-[var(--color-fg-muted)]">{account.id}</span>
      </p>
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
  const cls =
    "block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors";
  const inner = (
    <>
      <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
        {label}
      </p>
      <p className="text-3xl font-medium tabular-nums tracking-tight text-[var(--color-fg)]">
        {n}
      </p>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
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
  const cls = `block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 ${
    href
      ? "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
      : ""
  }`;
  const inner = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--color-fg-faint)] mb-1">
        {label}
      </p>
      <p className="text-lg font-medium tabular-nums text-[var(--color-fg-muted)]">
        {n}
      </p>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
