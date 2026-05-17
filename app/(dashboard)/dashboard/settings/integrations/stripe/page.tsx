import { and, desc, eq } from "drizzle-orm";
import { getDashboardContext } from "../../../../../../src/lib/web/dashboard-ctx.js";
import {
  getStripeStatus,
  type StripeStatus,
} from "../../../../../../src/integrations/stripe/connect.js";
import { db } from "../../../../../../src/db/client.js";
import { stripeEvents } from "../../../../../../src/db/schema.js";
import { ConnectStripeForm } from "./ConnectStripeForm";
import { DisconnectButton } from "./DisconnectButton";

export const dynamic = "force-dynamic";

const SYNCED_EVENTS: Array<{ event: string; effect: string }> = [
  { event: "customer.created", effect: "creates a contact in krabs (or links by Stripe customer id)." },
  { event: "customer.updated", effect: "updates the matching contact's email and name." },
  { event: "customer.subscription.created", effect: "starts a subscription record tied to the contact." },
  { event: "customer.subscription.updated", effect: "updates plan, status, and renewal dates on the subscription." },
  { event: "customer.subscription.deleted", effect: "marks the subscription as canceled." },
  { event: "invoice.paid", effect: "records a paid invoice + revenue line." },
  { event: "invoice.payment_failed", effect: "flags the contact for follow-up and logs the failure." },
  { event: "charge.refunded", effect: "subtracts the refund from recorded revenue and notes the reason." },
];

const REQUIRED_SCOPES: Array<{ scope: string; level: "Read" | "Write" }> = [
  { scope: "Webhook Endpoints", level: "Write" },
  { scope: "Customers", level: "Read" },
  { scope: "Subscriptions", level: "Read" },
  { scope: "Invoices", level: "Read" },
  { scope: "Charges", level: "Read" },
  { scope: "Refunds", level: "Read" },
  { scope: "Products", level: "Read" },
  { scope: "Prices", level: "Read" },
];

export default async function StripeIntegrationPage() {
  const { ctx } = await getDashboardContext();
  const status = await getStripeStatus(ctx);

  const recentEvents = status.connected
    ? await db
        .select({
          id: stripeEvents.id,
          type: stripeEvents.type,
          receivedAt: stripeEvents.receivedAt,
          processedAt: stripeEvents.processedAt,
          errorMessage: stripeEvents.errorMessage,
        })
        .from(stripeEvents)
        .where(and(eq(stripeEvents.accountId, ctx.accountId)))
        .orderBy(desc(stripeEvents.receivedAt))
        .limit(5)
    : [];

  return (
    <>
      <header className="st__pane-h">
        <div className="st__pane-eyebrow">integrations · stripe</div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="st__pane-title">Stripe</h1>
          <StatusPill status={status} />
        </div>
        <p className="k-body-sm text-muted-foreground max-w-2xl mt-3">
          Sync customers, subscriptions, invoices, and refunds from your Stripe
          account into krabs. Connect once with a Restricted API Key — krabs
          provisions the webhook for you.
        </p>
      </header>

      <div className="st__pane-body">
        {status.connected ? (
          <ConnectedState status={status} recentEvents={recentEvents} />
        ) : (
          <NotConnectedState />
        )}

        <section className="st-sec">
          <div className="st-sec__h">
            <h2 className="st-sec__title">What gets synced</h2>
            <p className="st-sec__sub">
              Every event krabs subscribes to and what it does on receive.
            </p>
          </div>
          <div className="st-sec__body">
            {SYNCED_EVENTS.map((s) => (
              <div key={s.event} className="st-row">
                <code className="font-mono text-[12.5px] text-foreground">
                  {s.event}
                </code>
                <span className="text-[13px] text-muted-foreground">
                  {s.effect}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="st-sec">
          <div className="st-sec__h">
            <h2 className="st-sec__title">Required Stripe permissions</h2>
            <p className="st-sec__sub">
              Set these scopes on the Restricted Key you create in Stripe.
              Anything else can stay at &ldquo;None.&rdquo;
            </p>
          </div>
          <div className="st-sec__body">
            {REQUIRED_SCOPES.map((p) => (
              <div key={p.scope} className="st-row">
                <span
                  className={`k-badge k-badge--${p.level === "Write" ? "accent" : "neutral"}`}
                >
                  {p.level === "Write" && <span className="k-badge__dot" />}
                  {p.level}
                </span>
                <span className="text-[13px]">{p.scope}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function StatusPill({ status }: { status: StripeStatus }) {
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

type ConnectedStatus = Extract<StripeStatus, { connected: true }>;

function ConnectedState({
  status,
  recentEvents,
}: {
  status: ConnectedStatus;
  recentEvents: Array<{
    id: string;
    type: string;
    receivedAt: string;
    processedAt: string | null;
    errorMessage: string | null;
  }>;
}) {
  return (
    <>
      <section className="st-sec">
        <div className="st-sec__h flex items-start justify-between gap-4">
          <div>
            <h2 className="st-sec__title">{status.displayName}</h2>
            <p className="st-sec__sub">Stripe account currently linked to krabs.</p>
          </div>
          <DisconnectButton displayName={status.displayName} />
        </div>
        <div className="st-sec__body">
          <div className="st-row">
            <div className="st-row__lbl">restricted key</div>
            <div className="st-row__v">
              <span className="font-mono text-[12.5px]">{status.maskedSecret}</span>
            </div>
          </div>
          <div className="st-row">
            <div className="st-row__lbl">stripe account id</div>
            <div className="st-row__v">
              {status.providerAccountId ? (
                <span className="font-mono text-[12.5px]">
                  {status.providerAccountId}
                </span>
              ) : (
                <span className="text-[12.5px] text-muted-foreground italic">
                  not available (key lacks &lsquo;account&rsquo; read scope)
                </span>
              )}
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
          <h2 className="st-sec__title">Recent events</h2>
          <p className="st-sec__sub">Last 5 webhooks Stripe sent.</p>
        </div>
        <div className="st-sec__body">
          {recentEvents.length === 0 ? (
            <p className="k-body-sm text-muted-foreground py-2">
              No events yet. They&apos;ll show up here as soon as Stripe sends
              the first webhook.
            </p>
          ) : (
            recentEvents.map((e) => (
              <div key={e.id} className="st-row">
                <code className="font-mono text-[12.5px] text-foreground truncate">
                  {e.type}
                </code>
                <div className="st-row__v" style={{ justifyContent: "space-between" }}>
                  <EventStatusPill
                    processed={Boolean(e.processedAt)}
                    error={Boolean(e.errorMessage)}
                  />
                  <span className="font-mono text-[11.5px] text-muted-foreground">
                    {relTime(e.receivedAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function EventStatusPill({
  processed,
  error,
}: {
  processed: boolean;
  error: boolean;
}) {
  if (error) return <span className="k-badge k-badge--danger">error</span>;
  if (processed) return <span className="k-badge k-badge--success">processed</span>;
  return <span className="k-badge k-badge--neutral">pending</span>;
}

function NotConnectedState() {
  return (
    <section className="st-sec">
      <div className="st-sec__h">
        <h2 className="st-sec__title">Connect your Stripe account</h2>
        <p className="st-sec__sub">
          Paste a Restricted API Key. krabs will register the webhook in your
          Stripe automatically — no manual setup required.
        </p>
      </div>
      <div className="st-sec__body" style={{ paddingTop: 8 }}>
        <ConnectStripeForm />
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
