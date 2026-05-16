import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { NameForm } from "./NameForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { account, clerkEmail } = await getDashboardContext();

  return (
    <div className="p-8 max-w-3xl">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-2"># settings</p>
      <h1 className="text-3xl font-medium mb-8">Account</h1>

      <Section label="identity">
        <Row k="account id" v={<code className="font-mono text-xs">{account.id}</code>} />
        <Row k="email" v={<span className="font-mono text-xs">{clerkEmail}</span>} />
        <Row k="created" v={<span className="font-mono text-xs">{account.createdAt}</span>} />
      </Section>

      <Section label="profile">
        <NameForm initial={account.name ?? ""} />
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
  const borderClass =
    tone === "danger" ? "border-[var(--color-danger)]/30" : "border-[var(--color-border)]";
  return (
    <section
      className={`bg-[var(--color-surface)] border ${borderClass} rounded-[var(--radius-md)] p-5 mb-6`}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-4">
        # {label}
      </p>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 py-1.5 text-sm">
      <span className="text-[var(--color-fg-muted)]">{k}</span>
      <span className="col-span-2">{v}</span>
    </div>
  );
}
