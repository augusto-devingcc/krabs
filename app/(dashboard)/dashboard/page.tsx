import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { BRAND } from "@/lib/brand.js";

export default async function DashboardOverview() {
  const { userId } = await auth();
  const user = await currentUser();

  return (
    <div className="p-8 max-w-4xl">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-2">
        # overview
      </p>
      <h1 className="text-3xl font-medium mb-2">
        Welcome{user?.firstName ? `, ${user.firstName}` : ""}.
      </h1>
      <p className="text-[var(--color-fg-muted)] mb-10 max-w-xl">
        {BRAND.tagline} The dashboard is where you (the human) can verify what
        your agents have done. Real work happens through the agent.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          href="/dashboard/keys"
          title="API keys"
          body="Provision a new key for an agent or revoke an existing one."
        />
        <Card
          href="/dashboard/audit"
          title="Audit log"
          body="Every mutation your agents have made, with intent and reversibility."
        />
        <Card
          href="/dashboard/contacts"
          title="Contacts"
          body="Browse, search, and edit. Or just ask your agent."
        />
        <Card
          href="/dashboard/settings"
          title="Settings"
          body="Account info, billing, danger zone."
        />
      </div>

      <pre className="mt-10 text-sm font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 max-w-2xl overflow-x-auto">
        <span className="text-[var(--color-fg-faint)]">$ </span>
        <span className="text-[var(--color-accent)]">clerk_user_id</span>{" "}
        <span className="text-[var(--color-fg-muted)]">{userId}</span>
      </pre>
    </div>
  );
}

function Card({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-border-strong)] transition-colors"
    >
      <p className="font-medium mb-1">{title}</p>
      <p className="text-sm text-[var(--color-fg-muted)]">{body}</p>
    </Link>
  );
}
