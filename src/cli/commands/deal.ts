import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { Deal } from "@/contract/schemas/deal.js";

export function dealCommand(): Command {
  const cmd = new Command("deal").description("Manage deals (revenue opportunities)");

  cmd
    .command("create")
    .description("Create a new deal")
    .requiredOption("--title <title>")
    .option("--contact <id>", "Contact id (cnt_...)")
    .option("--stage <stage>", "Free text (e.g. new|qualified|proposal|negotiation|closed)")
    .option("--status <status>", "open|won|lost")
    .option("--value <cents>", "Value in cents", (v: string) => Number(v))
    .option("--currency <code>", "ISO 4217 (e.g. USD)")
    .option("--close <date>", "YYYY-MM-DD")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const body: Record<string, unknown> = { title: opts.title };
      if (opts.contact) body.contactId = opts.contact;
      if (opts.stage) body.stage = opts.stage;
      if (opts.status) body.status = opts.status;
      if (opts.value !== undefined) body.value = opts.value;
      if (opts.currency) body.currency = opts.currency;
      if (opts.close) body.expectedCloseDate = opts.close;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "POST"; body: unknown; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "POST",
        body,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const result = await apiRequest<{ deal: Deal; dryRun: boolean; replayed: boolean }>(cfg, "/v1/deals", reqOpts);
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () => {
        const tag = result.dryRun ? "(dry-run)" : result.replayed ? "(replayed)" : "(created)";
        return [
          `${tag} ${result.deal.id}`,
          `  title:  ${result.deal.title}`,
          `  stage:  ${result.deal.stage}`,
          `  status: ${result.deal.status}`,
          `  value:  ${result.deal.value ?? "-"} ${result.deal.currency ?? ""}`,
        ].join("\n");
      });
    });

  cmd
    .command("list")
    .description("List deals")
    .option("--limit <n>", "Max items", (v: string) => Number(v))
    .option("--cursor <c>")
    .option("--contact <id>")
    .option("--stage <stage>")
    .option("--status <status>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string | number> = {};
      if (opts.limit) query.limit = opts.limit as number;
      if (opts.cursor) query.cursor = String(opts.cursor);
      if (opts.contact) query.contact_id = String(opts.contact);
      if (opts.stage) query.stage = String(opts.stage);
      if (opts.status) query.status = String(opts.status);
      const result = await apiRequest<{ items: Deal[]; nextCursor: string | null }>(cfg, "/v1/deals", { query });
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () => {
        if (result.items.length === 0) return "(no deals)";
        const header = `${pad("ID", 32)} ${pad("STAGE", 14)} ${pad("STATUS", 8)} ${pad("VALUE", 14)} TITLE`;
        const rows = result.items.map(
          (d) =>
            `${pad(d.id, 32)} ${pad(d.stage, 14)} ${pad(d.status, 8)} ${pad(String(d.value ?? "-"), 14)} ${d.title}`,
        );
        const lines = [header, ...rows];
        if (result.nextCursor) lines.push(`\nnext: --cursor ${result.nextCursor}`);
        return lines.join("\n");
      });
    });

  cmd
    .command("get")
    .argument("<id>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const r = await apiRequest<{ deal: Deal }>(cfg, `/v1/deals/${id}`);
      emit(r, pickFormat(opts.format), () => JSON.stringify(r.deal, null, 2));
    });

  cmd
    .command("update")
    .argument("<id>")
    .option("--title <t>")
    .option("--stage <s>")
    .option("--status <s>")
    .option("--value <n>", "Numeric", (v: string) => Number(v))
    .option("--currency <c>")
    .option("--close <date>")
    .option("--clear-value")
    .option("--clear-close")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const patch: Record<string, unknown> = {};
      if (opts.title !== undefined) patch.title = opts.title;
      if (opts.stage) patch.stage = opts.stage;
      if (opts.status) patch.status = opts.status;
      if (opts.clearValue) patch.value = null;
      else if (opts.value !== undefined) patch.value = opts.value;
      if (opts.currency) patch.currency = opts.currency;
      if (opts.clearClose) patch.expectedCloseDate = null;
      else if (opts.close) patch.expectedCloseDate = opts.close;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "PATCH"; body: unknown; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "PATCH",
        body: patch,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{ deal: Deal; before: Deal }>(cfg, `/v1/deals/${id}`, reqOpts);
      emit(r, pickFormat(opts.format), () => `(updated) ${r.deal.id}`);
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
        `/v1/deals/${id}`,
        reqOpts,
      );
      emit(r, pickFormat(opts.format), () =>
        `${r.dryRun ? "(would delete)" : "(deleted)"} ${r.deletedId}${r.agentActionId ? `\n  undo: socrm action undo ${r.agentActionId}` : ""}`,
      );
    });

  return cmd;
}
