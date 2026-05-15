import { Command } from "commander";
import { readConfig, writeConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, type OutputFormat } from "../output.js";

export function authCommand(): Command {
  const cmd = new Command("auth").description("Authenticate with the socrm API");

  cmd
    .command("login")
    .description("Store an API key in the local config")
    .requiredOption("--token <token>", "API key (crm_live_...)")
    .option("--api-url <url>", "API base URL", "http://localhost:3000")
    .option("--format <format>", "json|table|auto", "auto")
    .action((opts: { token: string; apiUrl: string; format: OutputFormat }) => {
      const path = writeConfig({ apiUrl: opts.apiUrl, token: opts.token });
      const fmt = pickFormat(opts.format);
      emit({ saved: true, path }, fmt, () => `✔ saved config to ${path}`);
    });

  cmd
    .command("status")
    .description("Show the authenticated account")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = readConfig();
      if (!cfg.token) {
        const fmt = pickFormat(opts.format);
        emit({ authenticated: false }, fmt, () => "✘ not authenticated");
        process.exit(0);
      }
      const data = await apiRequest<{
        account: { id: string; email: string };
        apiKeyId: string;
      }>({ apiUrl: cfg.apiUrl!, token: cfg.token }, "/v1/me");
      const fmt = pickFormat(opts.format);
      emit(
        { authenticated: true, ...data },
        fmt,
        () => `✔ ${data.account.email} (${data.account.id})\n  api key: ${data.apiKeyId}`,
      );
    });

  return cmd;
}
