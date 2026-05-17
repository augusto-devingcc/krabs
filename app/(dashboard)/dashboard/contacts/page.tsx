import Link from "next/link";
import { Search, Filter, ArrowRight } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="center">
      <EntityHeader
        title="contacts"
        description="People you and your agents talk to. Multi-channel identity supported — same person on email + WhatsApp + Telegram is one contact."
        count={items.length}
      />

      <form
        action="/dashboard/contacts"
        className="mb-6 flex flex-col sm:flex-row gap-2 max-w-3xl"
      >
        <div className="relative flex-1">
          <Search
            size={14}
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="search by name, email, phone…"
            className="pl-9"
          />
        </div>
        <Select name="status" defaultValue={sp.status || "all"}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="all statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all statuses</SelectItem>
            <SelectItem value="lead">lead</SelectItem>
            <SelectItem value="prospect">prospect</SelectItem>
            <SelectItem value="customer">customer</SelectItem>
            <SelectItem value="archived">archived</SelectItem>
          </SelectContent>
        </Select>
        <Select name="limit" defaultValue={String(limit)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="50 / page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline" size="sm">
          <Filter size={14} aria-hidden />
          Filter
        </Button>
      </form>

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
          <Button asChild variant="ghost" size="sm">
            <Link href={nextHref}>
              Next page <ArrowRight size={14} aria-hidden />
            </Link>
          </Button>
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
