import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { AgentAction } from "@/contract/schemas/agent-action.js";

export function actionCommand(): Command {
  const cmd = new Command("action").description("Inspect the agent audit log");

  cmd
    .command("list")
    .description("List recent agent actions")
    .option("--limit <n>", "Max items (1-200)", (v) => Number(v), 50)
    .option("--api-key-id <id>", "Filter by API key (which agent)")
    .option("--target-kind <kind>", "Filter by target kind")
    .option("--target-id <id>", "Filter by specific target id")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        limit?: number;
        apiKeyId?: string;
        targetKind?: string;
        targetId?: string;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const query: Record<string, string | number> = {};
        if (opts.limit) query.limit = opts.limit;
        if (opts.apiKeyId) query.api_key_id = opts.apiKeyId;
        if (opts.targetKind) query.target_kind = opts.targetKind;
        if (opts.targetId) query.target_id = opts.targetId;

        const result = await apiRequest<{ items: AgentAction[] }>(cfg, "/v1/actions", { query });
        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          if (result.items.length === 0) return "(no actions)";
          const header = `${pad("WHEN", 25)} ${pad("ACTOR", 32)} ${pad("OPERATION", 22)} TARGET`;
          const rows = result.items.map(
            (a) =>
              `${pad(a.createdAt, 25)} ${pad(a.apiKeyId, 32)} ${pad(a.operation, 22)} ${a.targetKind}:${a.targetId}`,
          );
          return [header, ...rows].join("\n");
        });
      },
    );

  return cmd;
}
