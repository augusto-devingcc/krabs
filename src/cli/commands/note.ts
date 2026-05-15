import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { Note } from "@/contract/schemas/note.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export function noteCommand(): Command {
  const cmd = new Command("note").description("Manage notes");

  cmd
    .command("create")
    .option("--body <text>", "Note body (use --body-stdin to pipe)")
    .option("--body-stdin")
    .option("--title <text>")
    .option("--contact <id>")
    .option("--deal <id>")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const body = opts.bodyStdin ? await readStdin() : (opts.body as string | undefined);
      if (!body) throw new Error("--body or --body-stdin required");
      const payload: Record<string, unknown> = { body };
      if (opts.title) payload.title = opts.title;
      if (opts.contact) payload.contactId = opts.contact;
      if (opts.deal) payload.dealId = opts.deal;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const r = await apiRequest<{ note: Note }>(cfg, "/v1/notes", { method: "POST", body: payload, headers });
      emit(r, pickFormat(opts.format), () =>
        `(created) ${r.note.id}\n  title: ${r.note.title ?? "-"}\n  contact: ${r.note.contactId ?? "-"}`,
      );
    });

  cmd
    .command("list")
    .option("--contact <id>")
    .option("--deal <id>")
    .option("--limit <n>", "Max items", (v: string) => Number(v))
    .option("--cursor <c>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string | number> = {};
      if (opts.contact) query.contact_id = String(opts.contact);
      if (opts.deal) query.deal_id = String(opts.deal);
      if (opts.limit) query.limit = opts.limit as number;
      if (opts.cursor) query.cursor = String(opts.cursor);
      const r = await apiRequest<{ items: Note[]; nextCursor: string | null }>(cfg, "/v1/notes", { query });
      emit(r, pickFormat(opts.format), () => {
        if (r.items.length === 0) return "(no notes)";
        const header = `${pad("ID", 32)} ${pad("WHEN", 25)} ${pad("CONTACT", 32)} TITLE`;
        return [
          header,
          ...r.items.map(
            (n) => `${pad(n.id, 32)} ${pad(n.createdAt, 25)} ${pad(n.contactId ?? "-", 32)} ${n.title ?? "-"}`,
          ),
        ].join("\n");
      });
    });

  cmd
    .command("get")
    .argument("<id>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const r = await apiRequest<{ note: Note }>(cfg, `/v1/notes/${id}`);
      emit(r, pickFormat(opts.format), () => JSON.stringify(r.note, null, 2));
    });

  cmd
    .command("update")
    .argument("<id>")
    .option("--body <t>")
    .option("--body-stdin")
    .option("--title <t>")
    .option("--clear-title")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const patch: Record<string, unknown> = {};
      if (opts.bodyStdin) patch.body = await readStdin();
      else if (opts.body !== undefined) patch.body = opts.body;
      if (opts.clearTitle) patch.title = null;
      else if (opts.title !== undefined) patch.title = opts.title;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "PATCH"; body: unknown; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "PATCH",
        body: patch,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{ note: Note }>(cfg, `/v1/notes/${id}`, reqOpts);
      emit(r, pickFormat(opts.format), () => `(updated) ${r.note.id}`);
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
      const r = await apiRequest<{ deletedId: string; dryRun: boolean }>(cfg, `/v1/notes/${id}`, reqOpts);
      emit(r, pickFormat(opts.format), () => `${r.dryRun ? "(would delete)" : "(deleted)"} ${r.deletedId}`);
    });

  return cmd;
}
