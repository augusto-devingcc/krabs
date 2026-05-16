import Link from "next/link";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { NameForm } from "./NameForm";
import { CopyAccountId } from "./CopyAccountId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { account, clerkEmail } = await getDashboardContext();

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <p className="k-eyebrow mb-2">crm · account</p>
        <h1 className="k-h2 mb-2">Account</h1>
        <p className="k-body-sm text-muted-foreground max-w-2xl">
          Tenant-level configuration. Your account is the boundary — every agent
          and key lives inside it.
        </p>
      </div>

      <Section title="Identity" eyebrow="identity">
        <Row k="account id" v={<CopyAccountId value={account.id} />} />
        <Separator />
        <Row
          k="email"
          v={
            <div className="flex flex-col">
              <span className="font-mono text-xs text-foreground">
                {clerkEmail}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                synced from Clerk
              </span>
            </div>
          }
        />
        <Separator />
        <Row
          k="created"
          v={<span className="font-mono text-xs">{account.createdAt}</span>}
        />
      </Section>

      <Section title="Profile" eyebrow="profile">
        <NameForm initial={account.name ?? ""} />
      </Section>

      <Section title="Your agents" eyebrow="agents">
        <p className="k-body-sm text-muted-foreground mb-4">
          API keys are how Claude Desktop, the CLI, and any other agent talk to
          your account.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/keys">View your API keys</Link>
        </Button>
      </Section>

      <Card
        className="mb-5 border-red-200 dark:border-red-900/40 rounded-xl"
        style={{ boxShadow: "var(--shadow-1)" }}
      >
        <CardContent className="py-6">
          <p className="k-eyebrow mb-1 text-red-700 dark:text-red-300">
            danger zone
          </p>
          <h2 className="k-h4 mb-2 text-red-700 dark:text-red-300">
            Delete account
          </h2>
          <p className="k-body-sm text-muted-foreground">
            Deleting an account is not yet self-serve.{" "}
            <a
              href="mailto:support@krabs.dev?subject=Delete%20my%20account"
              className="underline hover:text-foreground"
            >
              Email support@krabs.dev
            </a>{" "}
            and we&apos;ll wipe your tenant and confirm.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className="mb-5 border-border rounded-xl"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <CardContent className="py-6">
        <p className="k-eyebrow mb-1">{eyebrow}</p>
        <h2 className="k-h4 mb-4">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 text-sm">
      <span className="k-eyebrow pt-0.5">{k}</span>
      <span className="col-span-2">{v}</span>
    </div>
  );
}
