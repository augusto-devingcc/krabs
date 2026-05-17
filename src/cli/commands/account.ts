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

  // ── business profile ────────────────────────────────────────
  const profile = new Command("business-profile").description(
    "Read or set the business profile (revenue model, ad channels, contract size).",
  );

  profile
    .command("get")
    .description("Show the current business profile (null when the kickoff has not run yet).")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest<{ profile: unknown; setAt: string | null }>(
        cfg,
        "/v1/account/business-profile",
      );
      emit(result, pickFormat(opts.format), () =>
        result.profile === null
          ? "no business profile set — run `krabs account business-profile set ...`"
          : JSON.stringify(result.profile, null, 2),
      );
    });

  profile
    .command("set")
    .description("Set or replace the business profile.")
    .requiredOption(
      "--revenue-model <model>",
      "recurring_saas | one_time | hybrid | freelance | marketplace | other",
    )
    .option("--cadence <cadence>", "weekly|monthly|quarterly|yearly|per_project|mixed")
    .option(
      "--typical-contract-cents <int>",
      "Typical contract size in cents",
      (v) => parseInt(v, 10),
    )
    .option("--currency <iso>", "3-letter currency", "USD")
    .option(
      "--channels <list>",
      "Comma-separated active channels (meta_ads,google_ads,organic,referral,...)",
    )
    .option("--notes <text>")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        revenueModel: string;
        cadence?: string;
        typicalContractCents?: number;
        currency?: string;
        channels?: string;
        notes?: string;
        intent?: string;
        idempotencyKey?: string;
        dryRun?: boolean;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const body: Record<string, unknown> = {
          revenueModel: opts.revenueModel,
          currency: opts.currency ?? "USD",
        };
        if (opts.cadence) body.cadence = opts.cadence;
        if (opts.typicalContractCents !== undefined) {
          body.typicalContractCents = opts.typicalContractCents;
        }
        if (opts.channels) {
          body.activeChannels = opts.channels
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (opts.notes) body.notes = opts.notes;

        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const reqOpts: {
          method: "PUT";
          body: unknown;
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "PUT", body, headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };

        const result = await apiRequest<{
          profile: unknown;
          before: unknown;
          dryRun: boolean;
          replayed: boolean;
        }>(cfg, "/v1/account/business-profile", reqOpts);

        emit(result, pickFormat(opts.format), () => {
          const tag = result.dryRun ? "(dry-run)" : result.replayed ? "(replayed)" : "(saved)";
          return `${tag} business profile updated`;
        });
      },
    );

  cmd.addCommand(profile);

  return cmd;
}
