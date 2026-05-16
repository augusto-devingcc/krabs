import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTasks } from "../../../../src/domain/task.js";
import {
  EntityHeader,
  EntityEmpty,
  StatusPill,
} from "@/components/EntityTable";

export const dynamic = "force-dynamic";

type Task = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high";
  dueAt?: string | null;
  completedAt?: string | null;
};

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
  if (sp.status && ["open", "in_progress", "done", "cancelled"].includes(sp.status)) {
    filters.status = sp.status as "open" | "in_progress" | "done" | "cancelled";
  }
  if (sp.priority && ["low", "normal", "high"].includes(sp.priority)) {
    filters.priority = sp.priority as "low" | "normal" | "high";
  }
  const { items } = await listTasks(ctx, filters);

  const primary = (items as Task[]).filter(
    (t) => t.status === "open" || t.status === "in_progress"
  );
  const secondary = (items as Task[]).filter(
    (t) => t.status === "done" || t.status === "cancelled"
  );

  return (
    <div className="p-8 max-w-5xl">
      <EntityHeader
        title="tasks"
        description="Things to do. Tied optionally to a contact or deal. Set status=done and your agent stamps completedAt automatically."
        count={items.length}
      />

      <form action="/dashboard/tasks" className="mb-6 flex flex-col sm:flex-row gap-2">
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-border-strong)]"
        >
          <option value="">all statuses</option>
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="done">done</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select
          name="priority"
          defaultValue={sp.priority ?? ""}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-border-strong)]"
        >
          <option value="">any priority</option>
          <option value="high">high</option>
          <option value="normal">normal</option>
          <option value="low">low</option>
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
          description="No tasks yet. Your agent can add follow-ups, reminders, and to-dos for you."
          prompt='Add a task to follow up with Maria next Tuesday, high priority.'
        />
      ) : (
        <div className="space-y-8">
          {primary.length > 0 && (
            <TaskGroup label="active" tasks={primary} />
          )}
          {secondary.length > 0 && (
            <TaskGroup label="completed" tasks={secondary} muted />
          )}
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  label,
  tasks,
  muted,
}: {
  label: string;
  tasks: Task[];
  muted?: boolean;
}) {
  return (
    <section className={muted ? "opacity-70" : ""}>
      <div className="flex items-center gap-2 mb-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-faint)]">
          # {label}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg-muted)]">
          {tasks.length}
        </span>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        {tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} first={i === 0} />
        ))}
      </div>
    </section>
  );
}

function TaskRow({ task, first }: { task: Task; first: boolean }) {
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const checked = done || cancelled;
  return (
    <div
      className={`flex items-start gap-4 px-4 py-3.5 hover:bg-[var(--color-surface-2)] transition-colors ${first ? "" : "border-t border-[var(--color-border)]"}`}
    >
      <div
        className={`mt-0.5 w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 ${
          checked
            ? "bg-[var(--color-surface-2)] border-[var(--color-border-strong)]"
            : "bg-[var(--color-bg)] border-[var(--color-border-strong)]"
        }`}
        aria-hidden
      >
        {done && (
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">✓</span>
        )}
        {cancelled && (
          <span className="font-mono text-xs text-[var(--color-fg-faint)]">×</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${
            checked
              ? "line-through text-[var(--color-fg-faint)]"
              : "text-[var(--color-fg)]"
          }`}
          title={task.title}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--color-fg-faint)]">
          <span className="text-[var(--color-fg-faint)]">
            {task.id.slice(0, 10)}…
          </span>
          {task.dueAt && (
            <>
              <span>·</span>
              <span>due {task.dueAt.slice(0, 10)}</span>
            </>
          )}
          {task.completedAt && (
            <>
              <span>·</span>
              <span>done {task.completedAt.slice(0, 10)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusPill status={task.priority} tone="muted" />
        <StatusPill status={task.status} tone={checked ? "muted" : "default"} />
      </div>
    </div>
  );
}
