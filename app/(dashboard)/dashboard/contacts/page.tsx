import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listContacts } from "../../../../src/domain/contact.js";
import { EntityHeader, Table, Th, Td, StatusPill } from "@/components/EntityTable";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; cursor?: string }>;
}) {
  const { ctx } = await getDashboardContext();
  const sp = await searchParams;
  const filters: {
    limit: number;
    q?: string;
    status?: "lead" | "prospect" | "customer" | "archived";
    cursor?: string;
  } = { limit: 50 };
  if (sp.q) filters.q = sp.q;
  if (sp.status && ["lead", "prospect", "customer", "archived"].includes(sp.status)) {
    filters.status = sp.status as "lead" | "prospect" | "customer" | "archived";
  }
  if (sp.cursor) filters.cursor = sp.cursor;
  const { items, nextCursor } = await listContacts(ctx, filters);

  return (
    <div className="p-8 max-w-6xl">
      <EntityHeader
        title="contacts"
        description="People you and your agents talk to. Multi-channel identity supported — same person on email + WhatsApp + Telegram is one contact."
        count={items.length}
        examplePrompt='"Add Maria López (maria@example.com) to my CRM and tag her as warm-lead."'
      />

      <form action="/dashboard/contacts" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="search by name, email, phone…"
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm"
        >
          <option value="">all statuses</option>
          <option value="lead">lead</option>
          <option value="prospect">prospect</option>
          <option value="customer">customer</option>
          <option value="archived">archived</option>
        </select>
        <button
          type="submit"
          className="border border-[var(--color-border-strong)] px-4 py-2 rounded-[var(--radius-sm)] text-sm hover:border-[var(--color-fg-muted)]"
        >
          filter
        </button>
      </form>

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
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-[var(--color-fg-muted)]"
              >
                (no contacts match these filters)
              </td>
            </tr>
          ) : (
            items.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border)]">
                <Td mono muted>{c.id.slice(0, 12)}…</Td>
                <Td>{c.name}</Td>
                <Td mono>{c.primaryEmail ?? "—"}</Td>
                <Td mono>{c.primaryPhone ?? "—"}</Td>
                <Td><StatusPill status={c.status} /></Td>
                <Td muted>{rel(c.updatedAt)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {nextCursor && (
        <div className="mt-4 text-sm">
          <a
            href={`/dashboard/contacts?cursor=${nextCursor}${sp.q ? `&q=${sp.q}` : ""}${sp.status ? `&status=${sp.status}` : ""}`}
            className="text-[var(--color-accent)] font-mono hover:underline"
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
