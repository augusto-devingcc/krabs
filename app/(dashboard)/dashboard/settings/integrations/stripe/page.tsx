import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDashboardContext } from "../../../../../../src/lib/web/dashboard-ctx.js";
import {
  getStripeStatus,
  type StripeStatus,
} from "../../../../../../src/integrations/stripe/connect.js";
import { db } from "../../../../../../src/db/client.js";
import { stripeEvents } from "../../../../../../src/db/schema.js";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConnectStripeForm } from "./ConnectStripeForm";
import { DisconnectButton } from "./DisconnectButton";

export const dynamic = "force-dynamic";

const SYNCED_EVENTS: Array<{ event: string; effect: string }> = [
  {
    event: "customer.created",
    effect: "creates a contact in krabs (or links by Stripe customer id).",
  },
  {
    event: "customer.updated",
    effect: "updates the matching contact's email and name.",
  },
  {
    event: "customer.subscription.created",
    effect: "starts a subscription record tied to the contact.",
  },
  {
    event: "customer.subscription.updated",
    effect: "updates plan, status, and renewal dates on the subscription.",
  },
  {
    event: "customer.subscription.deleted",
    effect: "marks the subscription as canceled.",
  },
  { event: "invoice.paid", effect: "records a paid invoice + revenue line." },
  {
    event: "invoice.payment_failed",
    effect: "flags the contact for follow-up and logs the failure.",
  },
  {
    event: "charge.refunded",
    effect: "subtracts the refund from recorded revenue and notes the reason.",
  },
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
    <div className="p-8 max-w-[720px] mx-auto">
      <Breadcrumb />

      <div className="center__head">
        <h2 className="center__h">
          Stripe
          <span className="center__count">
            {status.connected ? "connected" : "disconnected"}
          </span>
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={status} />
        </div>
      </div>

      <p className="k-body-sm text-muted-foreground -mt-5 mb-7">
        Sync customers, subscriptions, invoices, and refunds from your Stripe
        account into krabs. Connect once with a Restricted API Key — krabs
        provisions the webhook for you.
      </p>

      {status.connected ? (
        <ConnectedState status={status} recentEvents={recentEvents} />
      ) : (
        <NotConnectedState />
      )}

      <Section title="What gets synced" eyebrow="sync">
        <ul className="flex flex-col">
          {SYNCED_EVENTS.map((s, i) => (
            <li key={s.event}>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-2.5 text-sm">
                <code className="font-mono text-xs text-foreground self-start pt-0.5">
                  {s.event}
                </code>
                <span className="text-muted-foreground">{s.effect}</span>
              </div>
              {i < SYNCED_EVENTS.length - 1 && <Separator />}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Required Stripe permissions" eyebrow="permissions">
        <p className="k-body-sm text-muted-foreground mb-4">
          Set these scopes on the Restricted Key you create in Stripe. Anything
          else can be left at &ldquo;None.&rdquo;
        </p>
        <ul className="flex flex-col">
          {REQUIRED_SCOPES.map((p, i) => (
            <li key={p.scope}>
              <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 py-2 text-sm items-center">
                <span className="font-mono text-[11px] uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-center">
                  {p.level}
                </span>
                <span>{p.scope}</span>
              </div>
              {i < REQUIRED_SCOPES.length - 1 && <Separator />}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Breadcrumb() {
  return (
    <nav className="mb-6 text-xs k-eyebrow flex items-center gap-1.5">
      <Link
        href="/dashboard/settings"
        className="text-muted-foreground hover:text-foreground"
      >
        settings
      </Link>
      <span className="text-muted-foreground">/</span>
      <span className="text-muted-foreground">integrations</span>
      <span className="text-muted-foreground">/</span>
      <span className="text-foreground">stripe</span>
    </nav>
  );
}

function StatusPill({ status }: { status: StripeStatus }) {
  if (!status.connected) {
    return (
      <span className="k-badge k-badge--neutral">disconnected</span>
    );
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
      <Card
        className="mb-5 border-border rounded-xl"
        style={{ boxShadow: "var(--shadow-1)" }}
      >
        <CardContent className="py-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="k-eyebrow mb-1">stripe account</p>
              <h2 className="k-h4">{status.displayName}</h2>
            </div>
            <DisconnectButton displayName={status.displayName} />
          </div>

          <Row k="restricted key">
            <span className="font-mono text-xs">{status.maskedSecret}</span>
          </Row>
          <Separator />
          <Row k="stripe account id">
            {status.providerAccountId ? (
              <span className="font-mono text-xs">
                {status.providerAccountId}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                not available (key lacks &lsquo;account&rsquo; read scope)
              </span>
            )}
          </Row>
          <Separator />
          <Row k="last synced">
            <span className="font-mono text-xs text-muted-foreground">
              {status.lastSyncedAt ? relTime(status.lastSyncedAt) : "—"}
            </span>
          </Row>
          {status.lastErrorMessage && (
            <>
              <Separator />
              <Row k="last error">
                <span className="font-mono text-xs text-destructive">
                  {status.lastErrorMessage}
                </span>
              </Row>
            </>
          )}
        </CardContent>
      </Card>

      <Section title="Recent events" eyebrow="events">
        {recentEvents.length === 0 ? (
          <p className="k-body-sm text-muted-foreground">
            No events yet. They&apos;ll show up here as soon as Stripe sends the
            first webhook.
          </p>
        ) : (
          <ul className="flex flex-col">
            {recentEvents.map((e, i) => (
              <li key={e.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 py-2.5 text-sm items-center">
                  <code className="font-mono text-xs text-foreground truncate">
                    {e.type}
                  </code>
                  <EventStatusPill
                    processed={Boolean(e.processedAt)}
                    error={Boolean(e.errorMessage)}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {relTime(e.receivedAt)}
                  </span>
                </div>
                {i < recentEvents.length - 1 && <Separator />}
              </li>
            ))}
          </ul>
        )}
      </Section>
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
  if (processed)
    return <span className="k-badge k-badge--success">processed</span>;
  return <span className="k-badge k-badge--neutral">pending</span>;
}

function NotConnectedState() {
  return (
    <Card
      className="mb-5 border-border rounded-xl"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <CardContent className="py-6">
        <p className="k-eyebrow mb-1">get started</p>
        <h2 className="k-h4 mb-1">Connect your Stripe account</h2>
        <p className="k-body-sm text-muted-foreground mb-6 max-w-xl">
          Paste a Restricted API Key. krabs will register the webhook in your
          Stripe automatically — no manual setup required.
        </p>
        <ConnectStripeForm />
      </CardContent>
    </Card>
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

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 text-sm">
      <span className="k-eyebrow pt-0.5">{k}</span>
      <span className="col-span-2">{children}</span>
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
