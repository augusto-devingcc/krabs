import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { Task } from "@/contract/schemas/task.js";

export function taskCommand(): Command {
  const cmd = new Command("task").description("Manage tasks");

  cmd
    .command("create")
    .requiredOption("--title <title>")
    .option("--description <text>")
    .option("--contact <id>")
    .option("--deal <id>")
    .option("--status <s>", "open|in_progress|done|cancelled")
    .option("--priority <p>", "low|normal|high")
    .option("--due <iso>")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const body: Record<string, unknown> = { title: opts.title };
      if (opts.description) body.description = opts.description;
      if (opts.contact) body.contactId = opts.contact;
      if (opts.deal) body.dealId = opts.deal;
      if (opts.status) body.status = opts.status;
      if (opts.priority) body.priority = opts.priority;
      if (opts.due) body.dueAt = opts.due;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const r = await apiRequest<{ task: Task; replayed: boolean }>(cfg, "/v1/tasks", {
        method: "POST",
        body,
        headers,
      });
      emit(r, pickFormat(opts.format), () =>
        `(created) ${r.task.id}\n  title: ${r.task.title}\n  status: ${r.task.status}\n  due: ${r.task.dueAt ?? "-"}`,
      );
    });

  cmd
    .command("list")
    .option("--contact <id>")
    .option("--deal <id>")
    .option("--status <s>")
    .option("--priority <p>")
    .option("--due-before <iso>")
    .option("--limit <n>", "Max items", (v: string) => Number(v))
    .option("--cursor <c>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string | number> = {};
      if (opts.contact) query.contact_id = String(opts.contact);
      if (opts.deal) query.deal_id = String(opts.deal);
      if (opts.status) query.status = String(opts.status);
      if (opts.priority) query.priority = String(opts.priority);
      if (opts.dueBefore) query.due_before = String(opts.dueBefore);
      if (opts.limit) query.limit = opts.limit as number;
      if (opts.cursor) query.cursor = String(opts.cursor);
      const r = await apiRequest<{ items: Task[]; nextCursor: string | null }>(cfg, "/v1/tasks", { query });
      emit(r, pickFormat(opts.format), () => {
        if (r.items.length === 0) return "(no tasks)";
        const header = `${pad("ID", 32)} ${pad("STATUS", 14)} ${pad("PRIO", 7)} ${pad("DUE", 25)} TITLE`;
        const rows = r.items.map(
          (t) => `${pad(t.id, 32)} ${pad(t.status, 14)} ${pad(t.priority, 7)} ${pad(t.dueAt ?? "-", 25)} ${t.title}`,
        );
        return [header, ...rows].join("\n");
      });
    });

  cmd
    .command("get")
    .argument("<id>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const r = await apiRequest<{ task: Task }>(cfg, `/v1/tasks/${id}`);
      emit(r, pickFormat(opts.format), () => JSON.stringify(r.task, null, 2));
    });

  cmd
    .command("update")
    .argument("<id>")
    .option("--title <t>")
    .option("--description <t>")
    .option("--status <s>")
    .option("--priority <p>")
    .option("--due <iso>")
    .option("--clear-due")
    .option("--contact <id>")
    .option("--deal <id>")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const patch: Record<string, unknown> = {};
      for (const k of ["title", "description", "status", "priority"] as const) {
        if (opts[k] !== undefined) patch[k] = opts[k];
      }
      if (opts.clearDue) patch.dueAt = null;
      else if (opts.due) patch.dueAt = opts.due;
      if (opts.contact) patch.contactId = opts.contact;
      if (opts.deal) patch.dealId = opts.deal;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "PATCH"; body: unknown; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "PATCH",
        body: patch,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{ task: Task; before: Task }>(cfg, `/v1/tasks/${id}`, reqOpts);
      emit(r, pickFormat(opts.format), () => `(updated) ${r.task.id}  status: ${r.before.status} → ${r.task.status}`);
    });

  cmd
    .command("delete")
    .argument("<id>")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "DELETE"; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "DELETE",
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{ deletedId: string; agentActionId: string | null; dryRun: boolean }>(
        cfg,
        `/v1/tasks/${id}`,
        reqOpts,
      );
      emit(r, pickFormat(opts.format), () => `${r.dryRun ? "(would delete)" : "(deleted)"} ${r.deletedId}`);
    });

  return cmd;
}
