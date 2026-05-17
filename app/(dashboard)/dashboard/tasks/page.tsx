import Link from "next/link";
import {
  Square,
  CheckSquare2,
  XSquare,
} from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTasks } from "../../../../src/domain/task.js";
import {
  EntityHeader,
  EntityEmpty,
  StatusPill,
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/EntityTable";
import { cn } from "@/components/lib/utils";

export const dynamic = "force-dynamic";

type Task = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high";
  dueAt?: string | null;
  completedAt?: string | null;
};

const VALID_STATUS = ["open", "in_progress", "done", "cancelled"] as const;
const VALID_PRIORITY = ["high", "normal", "low"] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  const { ctx } = await getDashboardContext();
  const sp = await searchParams;
  const filters: {
    limit: number;
    status?: "open" | "in_progress" | "done" | "cancelled";
    priority?: "low" | "normal" | "high";
  } = { limit: 200 };
  if (sp.status && (VALID_STATUS as readonly string[]).includes(sp.status)) {
    filters.status = sp.status as (typeof VALID_STATUS)[number];
  }
  if (sp.priority && (VALID_PRIORITY as readonly string[]).includes(sp.priority)) {
    filters.priority = sp.priority as (typeof VALID_PRIORITY)[number];
  }
  const { items } = await listTasks(ctx, filters);

  return (
    <div className="center">
      <EntityHeader
        title="tasks"
        description="Things to do. Tied optionally to a contact or deal. Set status=done and your agent stamps completedAt automatically."
        count={items.length}
      />

      {/* Filter chips — both axes (status + priority). */}
      <div className="cx__filters mb-6 flex flex-wrap items-center gap-1">
        <span className="k-eyebrow mr-1">status</span>
        <Chip label="all" href={chipHref(sp, "status", null)} active={!sp.status} />
        {VALID_STATUS.map((s) => (
          <Chip
            key={s}
            label={s.replace("_", " ")}
            href={chipHref(sp, "status", s)}
            active={sp.status === s}
          />
        ))}
        <span className="cx__filters-sep" />
        <span className="k-eyebrow mr-1">priority</span>
        <Chip label="any" href={chipHref(sp, "priority", null)} active={!sp.priority} />
        {VALID_PRIORITY.map((p) => (
          <Chip
            key={p}
            label={p}
            href={chipHref(sp, "priority", p)}
            active={sp.priority === p}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <EntityEmpty
          description="No tasks yet. Your agent can add follow-ups, reminders, and to-dos for you."
          prompt='Add a task to follow up with Maria next Tuesday, high priority.'
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: 32 }} />
              <TableHead>title</TableHead>
              <TableHead style={{ width: 110 }}>priority</TableHead>
              <TableHead style={{ width: 130 }}>status</TableHead>
              <TableHead style={{ width: 120, textAlign: "right" }}>due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items as Task[]).map((t) => {
              const done = t.status === "done";
              const cancelled = t.status === "cancelled";
              const checked = done || cancelled;
              const CheckboxIcon = done ? CheckSquare2 : cancelled ? XSquare : Square;
              return (
                <TableRow key={t.id}>
                  <TableCell style={{ paddingRight: 0 }}>
                    <CheckboxIcon
                      size={15}
                      aria-hidden
                      strokeWidth={1.5}
                      style={{
                        color: checked
                          ? "var(--fg-3)"
                          : "var(--fg)",
                      }}
                    />
                  </TableCell>
                  <TableCell
                    className={cn("dt-name-l", checked && "line-through text-muted-foreground")}
                  >
                    {t.title}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      status={t.priority}
                      pillTone={t.priority === "high" ? "warning" : "neutral"}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={t.status} />
                  </TableCell>
                  <TableCell className="dt-updated">
                    {t.dueAt ? t.dueAt.slice(0, 10) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Chip({
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
  sp: { status?: string; priority?: string },
  axis: "status" | "priority",
  value: string | null,
): string {
  const params = new URLSearchParams();
  if (axis !== "status" && sp.status) params.set("status", sp.status);
  if (axis !== "priority" && sp.priority) params.set("priority", sp.priority);
  if (value) params.set(axis, value);
  const qs = params.toString();
  return qs ? `/dashboard/tasks?${qs}` : "/dashboard/tasks";
}
