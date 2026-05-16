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

  const totalEntities = counts.contacts + counts.deals + counts.tasks + counts.notes;
  const isEmpty = totalEntities === 0;

  return (
    <div className="p-8 max-w-6xl">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-2"># overview</p>
      <h1 className="text-3xl font-medium mb-2">
        Welcome{clerkName ? `, ${clerkName}` : ""}.
      </h1>
      <p className="text-[var(--color-fg-muted)] mb-8 max-w-2xl">
        socrm is operated by your agents. This page summarises what they&apos;ve done.
      </p>

      {isEmpty && (
        <Link
          href="/dashboard/keys"
          className="block bg-[var(--color-surface)] border border-[var(--color-accent)] rounded-[var(--radius-md)] p-5 mb-6 hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <p className="font-mono text-sm text-[var(--color-accent)] mb-1">
            # next step
          </p>
          <p className="font-medium mb-1">Connect your first agent →</p>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Generate an API key, paste it into Claude Desktop / Cursor / your CLI, and the
            agent can start using your CRM. Setup is one config block.
          </p>
        </Link>
      )}

      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
        # entities
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
        <Stat href="/dashboard/contacts" label="contacts" n={counts.contacts} />
        <Stat href="/dashboard/deals" label="deals" n={counts.deals} />
        <Stat href="/dashboard/tasks" label="tasks" n={counts.tasks} />
        <Stat href="/dashboard/notes" label="notes" n={counts.notes} />
        <Stat href="/dashboard/tags" label="tags" n={counts.tags} />
        <Stat href="/dashboard/contacts" label="identities" n={counts.identities} subtle />
        <Stat label="interactions" n={counts.interactions} subtle />
        <Stat href="/dashboard/audit" label="actions" n={counts.actions} subtle />
        <Stat href="/dashboard/keys" label="api keys" n={counts.apiKeys} subtle />
      </div>

      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
        # recent activity
      </p>
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden font-mono text-xs">
        {recent.length === 0 ? (
          <div className="p-6 text-center text-[var(--color-fg-muted)]">
            (no activity yet — your agents will fill this column)
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {recent.map((a) => (
              <div key={a.id} className="px-4 py-2 flex gap-3 items-center">
                <span className="text-[var(--color-fg-faint)]">{a.createdAt.slice(11, 19)}</span>
                <span className="text-[var(--color-accent)]">{a.operation}</span>
                <span className="text-[var(--color-fg-muted)] truncate">
                  {a.intent ?? <span className="text-[var(--color-fg-faint)]">no intent</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="bg-[var(--color-surface-2)] px-4 py-2 text-[var(--color-fg-faint)]">
          <Link href="/dashboard/audit" className="hover:text-[var(--color-fg)]">
            see full audit log →
          </Link>
        </div>
      </div>

      <p className="mt-10 text-xs text-[var(--color-fg-faint)] font-mono">
        account: {account.id}
      </p>
    </div>
  );
}

function Stat({
  href,
  label,
  n,
  subtle,
}: {
  href?: string;
  label: string;
  n: number;
  subtle?: boolean;
}) {
  const cls = `block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 ${
    href ? "hover:border-[var(--color-border-strong)] transition-colors" : ""
  }`;
  const inner = (
    <>
      <p className="font-mono text-xs text-[var(--color-fg-muted)] mb-1">{label}</p>
      <p className={`text-2xl font-medium ${subtle ? "text-[var(--color-fg-muted)]" : ""}`}>
        {n}
      </p>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
