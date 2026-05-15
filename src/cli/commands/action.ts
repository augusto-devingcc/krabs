import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { AgentAction } from "@/contract/schemas/agent-action.js";

type UndoResult = {
  undoneActionId: string;
  operation: string;
  reversal: Record<string, unknown>;
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export function actionCommand(): Command {
  const cmd = new Command("action").description("Inspect and reverse the agent audit log");

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

  cmd
    .command("get")
    .description("Fetch a single action, including its full metadata (snapshots)")
    .argument("<id>", "Action id (act_...)")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest<AgentAction>(cfg, `/v1/actions/${id}`);
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () =>
        [
          result.id,
          `  when:      ${result.createdAt}`,
          `  actor:     ${result.apiKeyId}`,
          `  operation: ${result.operation}`,
          `  target:    ${result.targetKind}:${result.targetId}`,
          `  intent:    ${result.intent ?? "-"}`,
          result.metadata ? `  metadata:  ${JSON.stringify(result.metadata)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    });

  cmd
    .command("undo")
    .description("Reverse a previously-recorded action using its metadata snapshot")
    .argument("<id>", "Action id (act_...)")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run", "Show what would be reversed without doing it")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (
        id: string,
        opts: { intent?: string; idempotencyKey?: string; dryRun?: boolean; format: OutputFormat },
      ) => {
        const cfg = requireConfig();
        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const reqOpts: {
          method: "POST";
          body: unknown;
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "POST", body: {}, headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };
        const result = await apiRequest<UndoResult>(cfg, `/v1/actions/${id}/undo`, reqOpts);
        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(would reverse)" : "(reversed)";
          return [
            `${tag} ${result.undoneActionId}`,
            `  was:      ${result.operation}`,
            `  reversal: ${JSON.stringify(result.reversal)}`,
            result.agentActionId ? `  undo log: ${result.agentActionId}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        });
      },
    );

  return cmd;
}
