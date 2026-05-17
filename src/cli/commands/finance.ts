import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, type OutputFormat } from "../output.js";

export function financeCommand(): Command {
  const cmd = new Command("finance").description(
    "Read-only finance views: summary, MRR, expenses by category, funnel (ROAS/CAC).",
  );

  cmd
    .command("summary")
    .description("Revenue, expenses, net, MRR, ARR over a window. Defaults to month-to-date.")
    .option("--from <iso>", "ISO 8601 start of range")
    .option("--to <iso>", "ISO 8601 end of range")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { from?: string; to?: string; format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string> = {};
      if (opts.from) query.from = opts.from;
      if (opts.to) query.to = opts.to;
      const result = await apiRequest(cfg, "/v1/finance/summary", { query });
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  cmd
    .command("mrr")
    .description("MRR / ARR broken down by product and billing cycle.")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, "/v1/finance/mrr");
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  cmd
    .command("expenses-by-category")
    .description("Expenses bucketed by category over a window.")
    .option("--from <iso>")
    .option("--to <iso>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { from?: string; to?: string; format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string> = {};
      if (opts.from) query.from = opts.from;
      if (opts.to) query.to = opts.to;
      const result = await apiRequest(cfg, "/v1/finance/expenses-by-category", { query });
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  cmd
    .command("funnel")
    .description(
      "Funnel metrics: paid revenue, ad spend, new customers, ROAS, CAC, blended-CAC.",
    )
    .option("--from <iso>")
    .option("--to <iso>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { from?: string; to?: string; format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string> = {};
      if (opts.from) query.from = opts.from;
      if (opts.to) query.to = opts.to;
      const result = await apiRequest(cfg, "/v1/finance/funnel", { query });
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  return cmd;
}
