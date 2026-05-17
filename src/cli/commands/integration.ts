import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, type OutputFormat } from "../output.js";

export function integrationCommand(): Command {
  const cmd = new Command("integration").description(
    "Connect / disconnect external providers (Stripe, Resend). Same operations the dashboard runs — works headless.",
  );

  cmd.addCommand(stripeCommand());
  cmd.addCommand(resendCommand());

  return cmd;
}

function stripeCommand(): Command {
  const cmd = new Command("stripe").description("Stripe integration (live data sync via webhook).");

  cmd
    .command("status")
    .description("Show whether Stripe is connected and what's mirrored.")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, "/v1/integrations/stripe/status");
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  cmd
    .command("connect")
    .description("Connect Stripe by pasting a Restricted API Key. krabs registers the webhook automatically.")
    .requiredOption("--secret-key <rk_>", "Stripe Restricted API Key (rk_live_... or rk_test_...) or full sk_")
    .option("--display-name <name>", "Label shown in the dashboard", "Stripe")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: { secretKey: string; displayName: string; format: OutputFormat }) => {
        const cfg = requireConfig();
        const result = await apiRequest(cfg, "/v1/integrations/stripe", {
          method: "POST",
          body: { secretKey: opts.secretKey, displayName: opts.displayName },
        });
        emit(result, pickFormat(opts.format), () =>
          JSON.stringify(result, null, 2),
        );
      },
    );

  cmd
    .command("disconnect")
    .description("Disconnect Stripe and remove the webhook on Stripe's side.")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, "/v1/integrations/stripe", { method: "DELETE" });
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  return cmd;
}

function resendCommand(): Command {
  const cmd = new Command("resend").description("Resend integration (transactional email).");

  cmd
    .command("status")
    .description("Show whether Resend is connected and how many domains are verified.")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, "/v1/integrations/resend/status");
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  cmd
    .command("connect")
    .description("Connect Resend by pasting an API key.")
    .requiredOption("--secret-key <re_>", "Resend API key (re_...)")
    .option("--display-name <name>", "Label shown in the dashboard", "Resend")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: { secretKey: string; displayName: string; format: OutputFormat }) => {
        const cfg = requireConfig();
        const result = await apiRequest(cfg, "/v1/integrations/resend", {
          method: "POST",
          body: { secretKey: opts.secretKey, displayName: opts.displayName },
        });
        emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
      },
    );

  cmd
    .command("disconnect")
    .description("Disconnect Resend.")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, "/v1/integrations/resend", { method: "DELETE" });
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  // ── domain sub-tree ─────────────────────────────────────────
  const domain = new Command("domain").description("Manage sending domains (DNS-verified via Resend).");

  domain
    .command("list")
    .description("List sending domains for this account.")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, "/v1/email-domains");
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  domain
    .command("add")
    .description("Add a sending domain. Returns the DNS records you (or your agent) need to publish.")
    .requiredOption("--domain <name>", "Domain name, e.g. mail.acme.com")
    .option("--region <region>", "Resend region: us-east-1 | eu-west-1 | sa-east-1 | ap-northeast-1")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: { domain: string; region?: string; format: OutputFormat }) => {
        const cfg = requireConfig();
        const body: Record<string, unknown> = { domain: opts.domain };
        if (opts.region) body.region = opts.region;
        const result = await apiRequest(cfg, "/v1/email-domains", { method: "POST", body });
        emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
      },
    );

  domain
    .command("verify <id>")
    .description("Re-check DNS for a sending domain. Call after publishing the records.")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, `/v1/email-domains/${encodeURIComponent(id)}/verify`, {
        method: "POST",
      });
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  domain
    .command("remove <id>")
    .description("Remove a sending domain (also removes it from Resend).")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest(cfg, `/v1/email-domains/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
    });

  cmd.addCommand(domain);

  cmd
    .command("send-test")
    .description("Send a test email through Resend (must be from a verified domain).")
    .requiredOption("--from <addr>", "Sender address on a verified domain")
    .requiredOption("--to <addr>", "Recipient address")
    .requiredOption("--subject <subj>", "Subject line")
    .option("--text <body>", "Plain-text body")
    .option("--html <body>", "HTML body")
    .option("--reply-to <addr>", "Reply-to address")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        from: string;
        to: string;
        subject: string;
        text?: string;
        html?: string;
        replyTo?: string;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const body: Record<string, unknown> = {
          from: opts.from,
          to: opts.to,
          subject: opts.subject,
        };
        if (opts.text) body.text = opts.text;
        if (opts.html) body.html = opts.html;
        if (opts.replyTo) body.replyTo = opts.replyTo;
        const result = await apiRequest(cfg, "/v1/email/send", { method: "POST", body });
        emit(result, pickFormat(opts.format), () => JSON.stringify(result, null, 2));
      },
    );

  return cmd;
}
