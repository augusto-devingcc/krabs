import { getDashboardContext } from "../../../../../../src/lib/web/dashboard-ctx.js";
import {
  getResendStatus,
  type ResendStatus,
} from "../../../../../../src/integrations/resend/connect.js";
import { listDomains } from "../../../../../../src/integrations/resend/domains.js";
import { ConnectResendForm } from "./ConnectResendForm";
import { DisconnectButton } from "./DisconnectButton";
import { DomainManager, type Domain } from "./DomainManager";
import { SendTestEmail } from "./SendTestEmail";

export const dynamic = "force-dynamic";

const CAPABILITIES: Array<{ what: string; how: string }> = [
  {
    what: "outbound email",
    how: "agent or UI calls POST /v1/email/send and the email goes through Resend.",
  },
  {
    what: "custom sending domains",
    how: "add acme.com once — krabs registers it in Resend and shows the DNS to add.",
  },
  {
    what: "auto-logged interactions",
    how: "every send creates an interaction (kind=email_out) tied to the contact.",
  },
  {
    what: "agent-friendly defaults",
    how: "from defaults to noreply@<first verified domain> if you don't pass one.",
  },
];

export default async function ResendIntegrationPage() {
  const { ctx, clerkEmail } = await getDashboardContext();
  const status = await getResendStatus(ctx);
  const domains: Domain[] = status.connected
    ? (await listDomains(ctx)).items.map((d) => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        region: d.region,
        dnsRecords: d.dnsRecords,
        lastVerifiedAt: d.lastVerifiedAt,
        lastErrorMessage: d.lastErrorMessage,
      }))
    : [];

  const firstVerified = domains.find((d) => d.status === "verified");

  return (
    <>
      <header className="st__pane-h">
        <div className="st__pane-eyebrow">integrations · resend</div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="st__pane-title">Resend</h1>
          <StatusPill status={status} />
        </div>
        <p className="k-body-sm text-muted-foreground max-w-2xl mt-3">
          Send email from your own domain through Resend. Connect once with an
          API key, add your sending domain, and your agent (or the krabs API)
          can send email — every send auto-logs as an interaction on the
          contact.
        </p>
      </header>

      <div className="st__pane-body">
        {status.connected ? (
          <ConnectedState
            status={status}
            domains={domains}
            defaultTo={clerkEmail}
            defaultFrom={firstVerified ? `noreply@${firstVerified.domain}` : ""}
          />
        ) : (
          <NotConnectedState />
        )}

        <section className="st-sec">
          <div className="st-sec__h">
            <h2 className="st-sec__title">What this enables</h2>
            <p className="st-sec__sub">
              Once you&apos;re connected and verified, agents can send mail
              programmatically.
            </p>
          </div>
          <div className="st-sec__body">
            {CAPABILITIES.map((c) => (
              <div key={c.what} className="st-row">
                <code className="font-mono text-[12.5px] text-foreground">
                  {c.what}
                </code>
                <span className="text-[13px] text-muted-foreground">{c.how}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function StatusPill({ status }: { status: ResendStatus }) {
  if (!status.connected) {
    return <span className="k-badge k-badge--neutral">disconnected</span>;
  }
  if (status.status === "error") {
    return (
      <span className="k-badge k-badge--danger">
        <span className="k-badge__dot" />
        error
      </span>
    );
  }
  return (
    <span className="k-badge k-badge--success">
      <span className="k-badge__dot" />
      connected
    </span>
  );
}

type ConnectedStatus = Extract<ResendStatus, { connected: true }>;

function ConnectedState({
  status,
  domains,
  defaultTo,
  defaultFrom,
}: {
  status: ConnectedStatus;
  domains: Domain[];
  defaultTo: string;
  defaultFrom: string;
}) {
  const verifiedCount = status.verifiedDomainCount;
  const canSend = verifiedCount > 0;

  return (
    <>
      <section className="st-sec">
        <div className="st-sec__h flex items-start justify-between gap-4">
          <div>
            <h2 className="st-sec__title">{status.displayName}</h2>
            <p className="st-sec__sub">Resend account currently linked to krabs.</p>
          </div>
          <DisconnectButton displayName={status.displayName} />
        </div>
        <div className="st-sec__body">
          <div className="st-row">
            <div className="st-row__lbl">api key</div>
            <div className="st-row__v">
              <span className="font-mono text-[12.5px]">{status.maskedSecret}</span>
            </div>
          </div>
          <div className="st-row">
            <div className="st-row__lbl">domains</div>
            <div className="st-row__v">
              <span className="font-mono text-[12.5px]">
                {status.domainCount} total · {verifiedCount} verified
              </span>
            </div>
          </div>
          <div className="st-row">
            <div className="st-row__lbl">last synced</div>
            <div className="st-row__v">
              <span className="font-mono text-[12.5px] text-muted-foreground">
                {status.lastSyncedAt ? relTime(status.lastSyncedAt) : "—"}
              </span>
            </div>
          </div>
          {status.lastErrorMessage && (
            <div className="st-row">
              <div className="st-row__lbl" style={{ color: "var(--danger-500)" }}>
                last error
              </div>
              <div className="st-row__v">
                <span
                  className="font-mono text-[12px]"
                  style={{ color: "var(--danger-500)" }}
                >
                  {status.lastErrorMessage}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="st-sec">
        <div className="st-sec__h">
          <h2 className="st-sec__title">Sending domains</h2>
          <p className="st-sec__sub">
            Add a domain you own. krabs registers it with Resend and shows the
            DNS records you need to add.
          </p>
        </div>
        <div className="st-sec__body" style={{ paddingTop: 8 }}>
          <DomainManager domains={domains} />
        </div>
      </section>

      <section className="st-sec">
        <div className="st-sec__h">
          <h2 className="st-sec__title">Send test email</h2>
          <p className="st-sec__sub">
            Verify the full path: from address → Resend → inbox.
          </p>
        </div>
        <div className="st-sec__body" style={{ paddingTop: 8 }}>
          <SendTestEmail
            defaultTo={defaultTo}
            defaultFrom={defaultFrom}
            disabled={!canSend}
            disabledReason="Add and verify a domain above to enable sending."
          />
        </div>
      </section>
    </>
  );
}

function NotConnectedState() {
  return (
    <section className="st-sec">
      <div className="st-sec__h">
        <h2 className="st-sec__title">Connect your Resend account</h2>
        <p className="st-sec__sub">
          Paste a Resend API key. krabs uses it to register your sending domains
          and to send email on your behalf — your agent calls one endpoint and
          krabs handles the rest.
        </p>
      </div>
      <div className="st-sec__body" style={{ paddingTop: 8 }}>
        <ConnectResendForm />
      </div>
    </section>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
