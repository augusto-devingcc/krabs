import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listContacts } from "../../../../src/domain/contact.js";
import {
  EntityHeader,
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

  const currentStatus = sp.status && (VALID_STATUS as readonly string[]).includes(sp.status)
    ? (sp.status as typeof VALID_STATUS[number])
    : null;

  return (
    <div className="center">
      <EntityHeader
        title="contacts"
        description="People you and your agents talk to. Multi-channel identity supported — same person on email + WhatsApp + Telegram is one contact."
        count={items.length}
      />

      {/* Search bar — designer's `.st-input` height/style */}
      <form action="/dashboard/contacts" className="mb-3 flex items-center gap-2 max-w-3xl">
        <input type="hidden" name="limit" value={limit} />
        {currentStatus && <input type="hidden" name="status" value={currentStatus} />}
        <label className="st-input" style={{ flex: 1 }}>
          <Search size={13} aria-hidden style={{ color: "var(--fg-3)", flexShrink: 0 }} />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="search by name, email, phone…"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <select name="limit" defaultValue={String(limit)} className="st-select">
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
        <button type="submit" className="k-btn k-btn--secondary k-btn--md">
          Filter
        </button>
      </form>

      {/* Status filter chips — designer's `.cx__chip` row */}
      <div className="cx__filters mb-6">
        <StatusChip label="all" href={chipHref(sp, null)} active={!currentStatus} />
        {VALID_STATUS.map((s) => (
          <StatusChip
            key={s}
            label={s}
            href={chipHref(sp, s)}
            active={currentStatus === s}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <EntityEmpty
          description="No contacts match these filters. Add your first one with a single message."
          prompt='Add Maria López (maria@example.com) to my CRM and tag her as warm-lead.'
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>name</TableHead>
              <TableHead>email</TableHead>
              <TableHead>phone</TableHead>
              <TableHead style={{ width: 110 }}>status</TableHead>
              <TableHead style={{ width: 120, textAlign: "right" }}>updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="dt-name-l">{c.name}</TableCell>
                <TableCell className="dt-owner">{c.primaryEmail ?? "—"}</TableCell>
                <TableCell className="dt-owner">{c.primaryPhone ?? "—"}</TableCell>
                <TableCell>
                  <StatusPill status={c.status} />
                </TableCell>
                <TableCell className="dt-updated">{rel(c.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {nextHref && (
        <div className="mt-6 flex justify-center">
          <Link href={nextHref} className="k-btn k-btn--ghost k-btn--md">
            Next page <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={`cx__chip${active ? " cx__chip--active" : ""}`}>
      {label}
    </Link>
  );
}

function chipHref(
  sp: { q?: string; limit?: string },
  status: string | null,
): string {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.limit) params.set("limit", sp.limit);
  if (status) params.set("status", status);
  const qs = params.toString();
  return qs ? `/dashboard/contacts?${qs}` : "/dashboard/contacts";
}

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
