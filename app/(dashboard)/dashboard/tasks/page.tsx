import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listTasks } from "../../../../src/domain/task.js";
import { EntityHeader, Table, Th, Td, StatusPill } from "@/components/EntityTable";

export const dynamic = "force-dynamic";

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

  return (
    <div className="p-8 max-w-6xl">
      <EntityHeader
        title="tasks"
        description="Things to do. Tied optionally to a contact or deal. Set status=done and your agent stamps completedAt automatically."
        count={items.length}
        examplePrompt='"Add a task to follow up with Maria next Tuesday, high priority."'
      />

      <form action="/dashboard/tasks" className="mb-4 flex gap-2">
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm"
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
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm"
        >
          <option value="">any priority</option>
          <option value="high">high</option>
          <option value="normal">normal</option>
          <option value="low">low</option>
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
            <Th>title</Th>
            <Th>status</Th>
            <Th>priority</Th>
            <Th>due</Th>
            <Th>completed</Th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-fg-muted)]">
                (no tasks)
              </td>
            </tr>
          ) : (
            items.map((t) => (
              <tr key={t.id} className="border-t border-[var(--color-border)]">
                <Td mono muted>{t.id.slice(0, 12)}…</Td>
                <Td>{t.title}</Td>
                <Td><StatusPill status={t.status} /></Td>
                <Td><StatusPill status={t.priority} /></Td>
                <Td mono muted>{t.dueAt ? t.dueAt.slice(0, 10) : "—"}</Td>
                <Td mono muted>{t.completedAt ? t.completedAt.slice(0, 10) : "—"}</Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
