import Link from "next/link";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { NameForm } from "./NameForm";
import { CopyAccountId } from "./CopyAccountId";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { account, clerkEmail } = await getDashboardContext();

  return (
    <>
      <header className="st__pane-h">
        <div className="st__pane-eyebrow">crm · account</div>
        <h1 className="st__pane-title">Account</h1>
      </header>

      <div className="st__pane-body">
        <section className="st-sec">
          <div className="st-sec__h">
            <h2 className="st-sec__title">Identity</h2>
            <p className="st-sec__sub">
              Tenant-level identifiers. Synced from Clerk where possible.
            </p>
          </div>
          <div className="st-sec__body">
            <div className="st-row">
              <div>
                <div className="st-row__lbl">account id</div>
                <div className="st-row__hint">Reference this in your agent contracts.</div>
              </div>
              <div className="st-row__v">
                <CopyAccountId value={account.id} />
              </div>
            </div>
            <div className="st-row">
              <div>
                <div className="st-row__lbl">email</div>
                <div className="st-row__hint">Synced from Clerk on every sign-in.</div>
              </div>
              <div className="st-row__v">
                <span className="font-mono text-[12.5px] text-foreground">
                  {clerkEmail}
                </span>
              </div>
            </div>
            <div className="st-row">
              <div>
                <div className="st-row__lbl">created</div>
                <div className="st-row__hint">When this tenant was provisioned.</div>
              </div>
              <div className="st-row__v">
                <span className="font-mono text-[12.5px] text-foreground">
                  {account.createdAt}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="st-sec">
          <div className="st-sec__h">
            <h2 className="st-sec__title">Profile</h2>
            <p className="st-sec__sub">Display name shown in your dashboard.</p>
          </div>
          <div className="st-sec__body">
            <NameForm initial={account.name ?? ""} />
          </div>
        </section>

        <section className="st-sec">
          <div className="st-sec__h">
            <h2 className="st-sec__title">Your agents</h2>
            <p className="st-sec__sub">
              API keys are how Claude Desktop, the CLI, and any other agent talk to
              your account.
            </p>
          </div>
          <div className="st-sec__body">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/keys">View your API keys</Link>
            </Button>
          </div>
        </section>

        <section className="st-sec">
          <div
            className="st-sec__h"
            style={{ borderColor: "var(--danger-500)" }}
          >
            <h2 className="st-sec__title" style={{ color: "var(--danger-500)" }}>
              Danger zone
            </h2>
            <p className="st-sec__sub">
              Deleting an account is not yet self-serve.{" "}
              <a
                href="mailto:support@krabs.dev?subject=Delete%20my%20account"
                className="underline hover:text-foreground"
              >
                Email support@krabs.dev
              </a>{" "}
              and we&apos;ll wipe your tenant and confirm.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
