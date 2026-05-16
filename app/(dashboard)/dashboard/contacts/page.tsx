import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listContacts } from "../../../../src/domain/contact.js";
import {
  EntityHeader,
  EntityEmpty,
  Table,
  Th,
  Td,
  Tr,
  StatusPill,
} from "@/components/EntityTable";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["lead", "prospect", "customer", "archived"] as const;
const VALID_LIMITS = [25, 50, 100] as const;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    cursor?: string;
    limit?: string;
  }>;
}) {
  const { ctx } = await getDashboardContext();
  const sp = await searchParams;

  const parsedLimit = sp.limit ? parseInt(sp.limit, 10) : 50;
  const limit = (VALID_LIMITS as readonly number[]).includes(parsedLimit)
    ? parsedLimit
    : 50;

  const filters: {
    limit: number;
    q?: string;
    status?: "lead" | "prospect" | "customer" | "archived";
    cursor?: string;
  } = { limit };
  if (sp.q) filters.q = sp.q;
  if (sp.status && (VALID_STATUS as readonly string[]).includes(sp.status)) {
    filters.status = sp.status as (typeof VALID_STATUS)[number];
  }
  if (sp.cursor) filters.cursor = sp.cursor;
  const { items, nextCursor } = await listContacts(ctx, filters);

  const nextHref = nextCursor
    ? `/dashboard/contacts?cursor=${nextCursor}` +
      (sp.q ? `&q=${encodeURIComponent(sp.q)}` : "") +
      (sp.status ? `&status=${sp.status}` : "") +
      `&limit=${limit}`
    : null;

  return (
    <div className="p-8 max-w-6xl">
      <EntityHeader
        title="contacts"
        description="People you and your agents talk to. Multi-channel identity supported — same person on email + WhatsApp + Telegram is one contact."
        count={items.length}
      />

      <form
        action="/dashboard/contacts"
        className="mb-6 flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[var(--color-fg-faint)] text-sm pointer-events-none">
            ›
          </span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="search by name, email, phone…"
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-border-strong)] placeholder:text-[var(--color-fg-faint)]"
          />
        </div>
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-border-strong)]"
        >
          <option value="">all statuses</option>
          <option value="lead">lead</option>
          <option value="prospect">prospect</option>
          <option value="customer">customer</option>
          <option value="archived">archived</option>
        </select>
        <select
          name="limit"
          defaultValue={String(limit)}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-border-strong)]"
        >
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
        <button
          type="submit"
          className="bg-[var(--color-accent)] text-[var(--color-bg)] border border-[var(--color-accent)] px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          filter
        </button>
      </form>

      {items.length === 0 ? (
        <EntityEmpty
          description="No contacts match these filters. Add your first one with a single message."
          prompt='Add Maria López (maria@example.com) to my CRM and tag her as warm-lead.'
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>id</Th>
              <Th>name</Th>
              <Th>email</Th>
              <Th>phone</Th>
              <Th>status</Th>
              <Th>updated</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <Tr key={c.id}>
                <Td mono faint>{c.id.slice(0, 12)}…</Td>
                <Td>{c.name}</Td>
                <Td mono muted>{c.primaryEmail ?? "—"}</Td>
                <Td mono muted>{c.primaryPhone ?? "—"}</Td>
                <Td>
                  <StatusPill status={c.status} />
                </Td>
                <Td faint>{rel(c.updatedAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {nextHref && (
        <div className="mt-6 flex justify-center">
          <a
            href={nextHref}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            next page →
          </a>
        </div>
      )}
    </div>
  );
}

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
