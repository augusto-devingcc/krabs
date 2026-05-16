import { Command } from "commander";
import { readConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";

const DEFAULT_API_URL = "https://api.krabs.dev";

type OpDescriptor = {
  operation: string;
  description: string;
  destructive: boolean;
  idempotent: boolean;
  supportsDryRun: boolean;
  supportsIntent: boolean;
};

type ContractDescription = {
  schemaVersion: string;
  contract: Record<string, unknown>;
  operations: OpDescriptor[];
};

export function schemaCommand(): Command {
  const cmd = new Command("schema").description("Describe the agent-facing contract");

  cmd
    .command("describe", { isDefault: true })
    .description("Return the full operation catalog and contract metadata")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      // schema.describe is public — no auth required
      const cfg = readConfig();
      const apiUrl = cfg.apiUrl ?? DEFAULT_API_URL;
      const result = await apiRequest<ContractDescription>(
        { apiUrl, token: cfg.token ?? "" },
        "/v1/schema",
      );
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () => {
        const header = `${pad("OPERATION", 22)} ${pad("DRY", 4)} ${pad("IDEM", 5)} ${pad("DESTR", 6)} DESCRIPTION`;
        const rows = result.operations.map(
          (o) =>
            `${pad(o.operation, 22)} ${pad(o.supportsDryRun ? "yes" : "-", 4)} ${pad(o.idempotent ? "yes" : "-", 5)} ${pad(o.destructive ? "yes" : "-", 6)} ${o.description}`,
        );
        return [header, ...rows].join("\n");
      });
    });

  return cmd;
}
