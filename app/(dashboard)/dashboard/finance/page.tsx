import { Plus } from "lucide-react";
import { and, eq, inArray } from "drizzle-orm";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { getFinanceSummary } from "../../../../src/domain/finance.js";
import { listSubscriptions } from "../../../../src/domain/subscription.js";
import { listInvoices } from "../../../../src/domain/invoice.js";
import { listExpenses } from "../../../../src/domain/expense.js";
import { formatCents } from "../../../../src/domain/finance-utils.js";
import { db } from "../../../../src/db/client.js";
import { contacts, products } from "../../../../src/db/schema.js";
import {
  EntityEmpty,
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  StatusPill,
} from "@/components/EntityTable";

export const dynamic = "force-dynamic";

type PillTone = "neutral" | "accent" | "success" | "warning" | "danger";

function subscriptionTone(status: string): PillTone {
  switch (status) {
    case "active":
      return "success";
    case "trialing":
      return "neutral";
    case "paused":
      return "neutral";
    case "canceled":
    case "expired":
      return "danger";
    default:
      return "neutral";
  }
}

function invoiceTone(status: string): PillTone {
  switch (status) {
    case "paid":
      return "success";
    case "sent":
      return "neutral";
    case "overdue":
      return "danger";
    case "draft":
    case "void":
    case "refunded":
      return "neutral";
    default:
      return "neutral";
  }
}

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export default async function FinancePage() {
  const { ctx } = await getDashboardContext();

  const [summary, subsResult, invoicesResult, expensesResult] =
    await Promise.all([
      getFinanceSummary(ctx, {}),
      listSubscriptions(ctx, {}),
      listInvoices(ctx, {}),
      listExpenses(ctx, {}),
    ]);

  const activeSubs = subsResult.items.filter(
    (s) => s.status === "active" || s.status === "trialing" || s.status === "paused",
  );
  const recentInvoices = invoicesResult.items.slice(0, 20);
  const recentExpenses = expensesResult.items.slice(0, 20);

  const contactIds = Array.from(
    new Set<string>(
      [
        ...activeSubs.map((s) => s.contactId),
        ...recentInvoices.map((i) => i.contactId),
      ].filter(Boolean),
    ),
  );
  const productIds = Array.from(
    new Set<string>(
      activeSubs.map((s) => s.productId).filter((v): v is string => Boolean(v)),
    ),
  );

  const [contactRows, productRows] = await Promise.all([
    contactIds.length === 0
      ? Promise.resolve([] as { id: string; name: string }[])
      : db
          .select({ id: contacts.id, name: contacts.name })
          .from(contacts)
          .where(
            and(
              eq(contacts.accountId, ctx.accountId),
              inArray(contacts.id, contactIds),
            ),
          ),
    productIds.length === 0
      ? Promise.resolve([] as { id: string; name: string }[])
      : db
          .select({ id: products.id, name: products.name })
          .from(products)
          .where(
            and(
              eq(products.accountId, ctx.accountId),
              inArray(products.id, productIds),
            ),
          ),
  ]);

  const contactNames = new Map(contactRows.map((r) => [r.id, r.name]));
  const productNames = new Map(productRows.map((r) => [r.id, r.name]));

  const netPositive = summary.net_cents > 0;

  return (
    <div className="center">
      <div className="mb-8">
        <p className="k-eyebrow mb-2">crm · money</p>
        <h1 className="center__h">Money</h1>
        <p className="k-body-sm text-muted-foreground max-w-2xl mt-2">
          Track MRR, invoices, expenses, and net profit — across every line of
          business.
        </p>
      </div>

      {/* Top summary stats — .ag__summary horizontal bar with mono labels. */}
      <div className="ag__summary mb-10" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Stat label="mrr" value={`$${formatCents(summary.mrr_cents)}`} sub={`ARR $${formatCents(summary.arr_cents)} · ${summary.counts.active_subscriptions} active`} />
        <Stat
          label="net (this month)"
          value={`$${formatCents(summary.net_cents)}`}
          sub={`revenue $${formatCents(summary.revenue.paid_cents)} · expenses $${formatCents(summary.expenses.total_cents)}`}
          accent={netPositive}
        />
        <Stat label="outstanding" value={String(summary.counts.invoices_outstanding)} sub="invoices sent or overdue" />
      </div>

      <Section
        title="Subscriptions"
        cliExample="krabs subscription create --contact ctc_... --product prd_... --amount 12000 --cycle monthly"
        actionLabel="New subscription"
      >
        {activeSubs.length === 0 ? (
          <EntityEmpty
            description="No active subscriptions yet. Recurring revenue lives here."
            prompt="krabs subscription create --contact ctc_... --product prd_... --amount 12000 --cycle monthly"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>contact</TableHead>
                <TableHead>product</TableHead>
                <TableHead style={{ textAlign: "right", width: 100 }}>mrr</TableHead>
                <TableHead style={{ width: 110 }}>cycle</TableHead>
                <TableHead style={{ width: 120 }}>status</TableHead>
                <TableHead style={{ textAlign: "right", width: 130 }}>next renewal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSubs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="dt-name-l">
                    {contactNames.get(s.contactId) ?? (
                      <span className="dt-owner">{s.contactId.slice(0, 12)}…</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.productId
                      ? (productNames.get(s.productId) ?? (
                          <span className="font-mono text-xs">
                            {s.productId.slice(0, 12)}…
                          </span>
                        ))
                      : "—"}
                  </TableCell>
                  <TableCell className="dt-value">
                    ${formatCents(s.mrrCents)}
                  </TableCell>
                  <TableCell className="dt-owner">{s.billingCycle}</TableCell>
                  <TableCell>
                    <StatusPill status={s.status} pillTone={subscriptionTone(s.status)} />
                  </TableCell>
                  <TableCell className="dt-updated">
                    {shortDate(s.currentPeriodEnd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title="Invoices"
        cliExample="krabs invoice create --contact ctc_... --amount 50000"
        actionLabel="New invoice"
      >
        {recentInvoices.length === 0 ? (
          <EntityEmpty
            description="No invoices yet. Bill a customer to get started."
            prompt="krabs invoice create --contact ctc_... --amount 50000"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 130 }}>number</TableHead>
                <TableHead>contact</TableHead>
                <TableHead style={{ textAlign: "right", width: 110 }}>amount</TableHead>
                <TableHead style={{ width: 110 }}>status</TableHead>
                <TableHead style={{ width: 110 }}>issued</TableHead>
                <TableHead style={{ textAlign: "right", width: 110 }}>due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="dt-owner">{inv.number}</TableCell>
                  <TableCell className="dt-name-l">
                    {contactNames.get(inv.contactId) ?? (
                      <span className="dt-owner">{inv.contactId.slice(0, 12)}…</span>
                    )}
                  </TableCell>
                  <TableCell className="dt-value">
                    ${formatCents(inv.amountCents)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={inv.status} pillTone={invoiceTone(inv.status)} />
                  </TableCell>
                  <TableCell className="dt-owner">{rel(inv.issuedAt)}</TableCell>
                  <TableCell className="dt-updated">{shortDate(inv.dueAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title="Expenses"
        cliExample="krabs expense create --amount 4900 --category infra --vendor Vercel"
        actionLabel="Log expense"
      >
        {recentExpenses.length === 0 ? (
          <EntityEmpty
            description="No expenses logged. Track infra, ads, and contractors here."
            prompt="krabs expense create --amount 4900 --category infra --vendor Vercel"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 110 }}>when</TableHead>
                <TableHead style={{ width: 130 }}>category</TableHead>
                <TableHead style={{ width: 140 }}>vendor</TableHead>
                <TableHead style={{ textAlign: "right", width: 110 }}>amount</TableHead>
                <TableHead style={{ width: 110 }}>source</TableHead>
                <TableHead>description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentExpenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="dt-owner">{rel(e.occurredAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={e.category} pillTone="neutral" />
                  </TableCell>
                  <TableCell className="dt-owner">{e.vendor ?? "—"}</TableCell>
                  <TableCell className="dt-value">
                    -${formatCents(e.amountCents)}
                  </TableCell>
                  <TableCell className="dt-owner">{e.source}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {truncate(e.description, 60)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="ag__summary-stat">
      <div className="ag__summary-k">{label}</div>
      <div
        className="ag__summary-v"
        style={accent ? { color: "var(--accent-500)" } : undefined}
      >
        {value}
      </div>
      <div className="font-mono text-[11px] text-muted-foreground mt-2 leading-snug">
        {sub}
      </div>
    </div>
  );
}

// Phase A: no modal create forms yet. <details> shows the equivalent CLI invocation
// so the button is self-documenting and never lies about being "disabled".
function Section({
  title,
  cliExample,
  actionLabel,
  children,
}: {
  title: string;
  cliExample: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-10 pt-8 border-t"
      style={{ borderColor: "var(--border-light)" }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <details className="group relative">
          <summary
            className="list-none cursor-pointer inline-flex items-center gap-1.5 h-7 px-3 rounded-[var(--radius-2)] border text-[12.5px] text-foreground hover:bg-muted/50 transition-colors"
            style={{ borderColor: "var(--border-light)" }}
          >
            <Plus size={13} aria-hidden />
            {actionLabel}
          </summary>
          <div
            className="absolute right-0 mt-2 z-10 w-[420px] max-w-[90vw] p-3 rounded-[var(--radius-3)] border bg-popover shadow-md"
            style={{ borderColor: "var(--border-light)" }}
          >
            <p className="k-eyebrow mb-2">use the cli</p>
            <p className="k-body-sm text-muted-foreground mb-2">
              Create flows ship in v0.5. For now, your agent or terminal does
              this directly:
            </p>
            <code
              className="font-mono text-xs block border rounded-[var(--radius-2)] bg-muted px-2.5 py-2 break-all"
              style={{ borderColor: "var(--border-light)" }}
            >
              <span className="text-muted-foreground select-none">$ </span>
              {cliExample}
            </code>
          </div>
        </details>
      </div>
      {children}
    </section>
  );
}
