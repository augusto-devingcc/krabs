import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, type OutputFormat } from "../output.js";
import { portabilityCommands } from "./portability.js";

type Account = {
  id: string;
  email: string;
  name: string | null;
};

export function accountCommand(): Command {
  const cmd = new Command("account").description("Manage the current account");

  cmd
    .command("get")
    .description("Show the current account")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest<{ account: Account }>(cfg, "/v1/account");
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () =>
        [`${result.account.id}`, `  email: ${result.account.email}`, `  name:  ${result.account.name ?? "-"}`].join(
          "\n",
        ),
      );
    });

  cmd
    .command("update")
    .description("Update the account name or email")
    .option("--name <name>")
    .option("--email <email>")
    .option("--clear-name", "Set name to null")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        name?: string;
        email?: string;
        clearName?: boolean;
        intent?: string;
        idempotencyKey?: string;
        dryRun?: boolean;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const patch: Record<string, unknown> = {};
        if (opts.clearName) patch.name = null;
        else if (opts.name !== undefined) patch.name = opts.name;
        if (opts.email !== undefined) patch.email = opts.email;

        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const reqOpts: {
          method: "PATCH";
          body: unknown;
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "PATCH" as never, body: patch, headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };

        const result = await apiRequest<{
          account: Account;
          before: Account;
          dryRun: boolean;
          replayed: boolean;
        }>(cfg, "/v1/account", reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(dry-run)" : result.replayed ? "(replayed)" : "(updated)";
          return [
            `${tag} ${result.account.id}`,
            `  email: ${result.before.email} → ${result.account.email}`,
            `  name:  ${result.before.name ?? "-"} → ${result.account.name ?? "-"}`,
          ].join("\n");
        });
      },
    );

  cmd.addCommand(portabilityCommands().accountExport);

  return cmd;
}
