import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";

type ApiKeySummary = {
  id: string;
  label: string;
  tokenPreview: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function keyCommand(): Command {
  const cmd = new Command("key").description("Manage API keys");

  cmd
    .command("list")
    .description("List API keys for this account")
    .option("--include-revoked")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { includeRevoked?: boolean; format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string> = {};
      if (opts.includeRevoked) query.include_revoked = "1";
      const result = await apiRequest<{ items: ApiKeySummary[] }>(cfg, "/v1/api-keys", { query });
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () => {
        if (result.items.length === 0) return "(no keys)";
        const header = `${pad("ID", 32)} ${pad("LABEL", 20)} ${pad("PREVIEW", 22)} ${pad("LAST USED", 26)} ${pad("REVOKED", 26)}`;
        const rows = result.items.map(
          (k) =>
            `${pad(k.id, 32)} ${pad(k.label, 20)} ${pad(k.tokenPreview, 22)} ${pad(k.lastUsedAt ?? "-", 26)} ${pad(k.revokedAt ?? "-", 26)}`,
        );
        return [header, ...rows].join("\n");
      });
    });

  cmd
    .command("create")
    .description("Create a new API key. The plaintext token is shown ONCE.")
    .requiredOption("--label <label>", "Human-readable label, e.g. 'Claude Code on MacBook'")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        label: string;
        intent?: string;
        idempotencyKey?: string;
        dryRun?: boolean;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const reqOpts: {
          method: "POST";
          body: unknown;
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "POST", body: { label: opts.label }, headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };

        const result = await apiRequest<{
          apiKey: ApiKeySummary;
          token: string;
          dryRun: boolean;
          replayed: boolean;
        }>(cfg, "/v1/api-keys", reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(dry-run)" : result.replayed ? "(replayed)" : "(created)";
          return [
            `${tag} ${result.apiKey.id}`,
            `  label:   ${result.apiKey.label}`,
            `  token:   ${result.token}`,
            "",
            result.dryRun ? "" : "Store this token now — it is not retrievable again.",
          ]
            .filter(Boolean)
            .join("\n");
        });
      },
    );

  cmd
    .command("revoke")
    .description("Revoke an API key (immediate; current token holders lose access on next call)")
    .argument("<id>", "API key id (key_...)")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (
        id: string,
        opts: {
          intent?: string;
          idempotencyKey?: string;
          dryRun?: boolean;
          format: OutputFormat;
        },
      ) => {
        const cfg = requireConfig();
        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const reqOpts: {
          method: "DELETE";
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "DELETE", headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };

        const result = await apiRequest<{
          apiKey: ApiKeySummary;
          dryRun: boolean;
          replayed: boolean;
        }>(cfg, `/v1/api-keys/${id}`, reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(would revoke)" : "(revoked)";
          return [`${tag} ${result.apiKey.id}`, `  label:   ${result.apiKey.label}`, `  revoked: ${result.apiKey.revokedAt ?? "-"}`].join("\n");
        });
      },
    );

  return cmd;
}
