import Link from "next/link";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { NameForm } from "./NameForm";
import { CopyAccountId } from "./CopyAccountId";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { account, clerkEmail } = await getDashboardContext();

  return (
    <div className="p-8 max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
        # settings
      </p>
      <h1 className="text-3xl font-medium mb-2">Account</h1>
      <p className="text-[var(--color-fg-muted)] mb-8 max-w-2xl">
        Tenant-level configuration. Your account is the boundary — every agent and key lives
        inside it.
      </p>

      <Section label="identity">
        <Row k="account id" v={<CopyAccountId value={account.id} />} />
        <Row
          k="email"
          v={
            <div className="flex flex-col">
              <span className="font-mono text-xs text-[var(--color-fg)]">{clerkEmail}</span>
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-fg-faint)] mt-0.5">
                synced from Clerk
              </span>
            </div>
          }
        />
        <Row k="created" v={<span className="font-mono text-xs">{account.createdAt}</span>} />
      </Section>

      <Section label="profile">
        <NameForm initial={account.name ?? ""} />
      </Section>

      <Section label="your agents">
        <p className="text-sm text-[var(--color-fg-muted)] mb-3">
          API keys are how Claude Desktop, the CLI, and any other agent talk to your account.
        </p>
        <Link
          href="/dashboard/keys"
          className="inline-block font-mono text-sm text-[var(--color-fg)] hover:underline"
        >
          View your API keys →
        </Link>
      </Section>

      <Section label="danger zone" tone="danger">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Deleting an account is not yet self-serve.{" "}
          <a
            href="mailto:support@socrm.dev?subject=Delete%20my%20account"
            className="underline hover:text-[var(--color-fg)]"
          >
            Email support@socrm.dev
          </a>{" "}
          and we&apos;ll wipe your tenant and confirm.
        </p>
      </Section>
    </div>
  );
}

function Section({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  const isDanger = tone === "danger";
  const borderClass = isDanger ? "border-[var(--color-danger)]/40" : "border-[var(--color-border)]";
  const labelColor = isDanger ? "text-[var(--color-danger)]" : "text-[var(--color-fg-muted)]";
  const prefix = isDanger ? "⚠ " : "# ";
  return (
    <section
      className={`bg-[var(--color-surface)] border ${borderClass} rounded-[var(--radius-md)] p-6 mb-5`}
    >
      <p
        className={`font-mono text-xs uppercase tracking-wide mb-4 ${labelColor}`}
      >
        {prefix}
        {label}
      </p>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 text-sm border-b border-[var(--color-border)] last:border-b-0">
      <span className="text-[var(--color-fg-muted)] font-mono text-xs uppercase tracking-wide pt-0.5">
        {k}
      </span>
      <span className="col-span-2">{v}</span>
    </div>
  );
}
