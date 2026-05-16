import {
  CheckSquare,
  Square,
  CheckSquare2,
  XSquare,
  History,
  Filter,
  Flame,
} from "lucide-react";
import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTasks } from "../../../../src/domain/task.js";
import { EntityHeader, EntityEmpty, StatusPill } from "@/components/EntityTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
        icon={CheckSquare}
        title="tasks"
        description="Things to do. Tied optionally to a contact or deal. Set status=done and your agent stamps completedAt automatically."
        count={items.length}
      />

      <form action="/dashboard/tasks" className="mb-6 flex flex-col sm:flex-row gap-2">
        <Select name="status" defaultValue={sp.status || "all"}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="all statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all statuses</SelectItem>
            <SelectItem value="open">open</SelectItem>
            <SelectItem value="in_progress">in_progress</SelectItem>
            <SelectItem value="done">done</SelectItem>
            <SelectItem value="cancelled">cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select name="priority" defaultValue={sp.priority || "any"}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="any priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">any priority</SelectItem>
            <SelectItem value="high">high</SelectItem>
            <SelectItem value="normal">normal</SelectItem>
            <SelectItem value="low">low</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Filter <Filter size={16} aria-hidden />
        </Button>
      </form>

      {items.length === 0 ? (
        <EntityEmpty
          icon={CheckSquare}
          description="No tasks yet. Your agent can add follow-ups, reminders, and to-dos for you."
          prompt='Add a task to follow up with Maria next Tuesday, high priority.'
        />
      ) : (
        <div className="flex flex-col gap-8">
          {primary.length > 0 && <TaskGroup label="active" tasks={primary} />}
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
        {muted && <History size={14} aria-hidden className="text-muted-foreground" />}
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          # {label}
        </p>
        <Badge variant="outline" className="font-mono text-[10px]">
          {tasks.length}
        </Badge>
      </div>
      <Card className="py-0 gap-0">
        <CardContent className="px-0">
          {tasks.map((t, i) => (
            <TaskRow key={t.id} task={t} first={i === 0} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function TaskRow({ task, first }: { task: Task; first: boolean }) {
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const checked = done || cancelled;

  const CheckboxIcon = done ? CheckSquare2 : cancelled ? XSquare : Square;

  return (
    <div
      className={cn(
        "flex items-start gap-4 px-4 py-3.5 hover:bg-muted/50 transition-colors",
        !first && "border-t border-border"
      )}
    >
      <CheckboxIcon
        size={20}
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0",
          checked ? "text-muted-foreground" : "text-foreground"
        )}
      />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            checked
              ? "line-through text-muted-foreground"
              : "text-foreground"
          )}
          title={task.title}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span>{task.id.slice(0, 10)}…</span>
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
        <Badge variant="outline" className="font-mono text-[11px]">
          {task.priority === "high" && (
            <Flame size={14} aria-hidden className="text-muted-foreground" />
          )}
          {task.priority}
        </Badge>
        <StatusPill status={task.status} variant={checked ? "outline" : "secondary"} />
      </div>
    </div>
  );
}
