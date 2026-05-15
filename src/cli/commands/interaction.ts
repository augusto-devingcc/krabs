import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { Interaction } from "@/contract/schemas/interaction.js";
import type { Contact } from "@/contract/schemas/contact.js";
import type { Identity } from "@/contract/schemas/identity.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export function interactionCommand(): Command {
  const cmd = new Command("interaction").description("Manage interactions (the contact timeline)");

  cmd
    .command("list")
    .description("List interactions (filter by contact, kind, since)")
    .option("--contact <id>")
    .option("--kind <kind>")
    .option("--since <iso>")
    .option("--limit <n>", "Max items", (v: string) => Number(v))
    .option("--cursor <cursor>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        contact?: string;
        kind?: string;
        since?: string;
        limit?: number;
        cursor?: string;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const query: Record<string, string | number> = {};
        if (opts.contact) query.contact_id = opts.contact;
        if (opts.kind) query.kind = opts.kind;
        if (opts.since) query.since = opts.since;
        if (opts.limit) query.limit = opts.limit;
        if (opts.cursor) query.cursor = opts.cursor;
        const result = await apiRequest<{ items: Interaction[]; nextCursor: string | null }>(
          cfg,
          "/v1/interactions",
          { query },
        );
        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          if (result.items.length === 0) return "(no interactions)";
          const header = `${pad("WHEN", 25)} ${pad("KIND", 12)} ${pad("CONTACT", 32)} SUBJECT`;
          const rows = result.items.map(
            (i) =>
              `${pad(i.occurredAt, 25)} ${pad(i.kind, 12)} ${pad(i.contactId ?? "-", 32)} ${i.subject ?? ""}`,
          );
          return [header, ...rows].join("\n");
        });
      },
    );

  cmd
    .command("create")
    .description("Manually create an interaction")
    .requiredOption("--kind <kind>", "email_in|email_out|call|meeting|message|note|agent_log|custom")
    .option("--contact <id>")
    .option("--direction <dir>", "inbound|outbound|internal")
    .option("--source <text>")
    .option("--subject <text>")
    .option("--body <text>")
    .option("--occurred-at <iso>", "When it happened (default: now)")
    .option("--metadata <json>", "Free-form JSON metadata")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        kind: string;
        contact?: string;
        direction?: string;
        source?: string;
        subject?: string;
        body?: string;
        occurredAt?: string;
        metadata?: string;
        intent?: string;
        idempotencyKey?: string;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const body: Record<string, unknown> = { kind: opts.kind };
        if (opts.contact) body.contactId = opts.contact;
        if (opts.direction) body.direction = opts.direction;
        if (opts.source) body.source = opts.source;
        if (opts.subject) body.subject = opts.subject;
        if (opts.body) body.body = opts.body;
        if (opts.occurredAt) body.occurredAt = opts.occurredAt;
        if (opts.metadata) body.metadata = JSON.parse(opts.metadata);
        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const result = await apiRequest<{ interaction: Interaction; replayed: boolean }>(
          cfg,
          "/v1/interactions",
          { method: "POST", body, headers },
        );
        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.replayed ? "(replayed)" : "(created)";
          return [
            `${tag} ${result.interaction.id}`,
            `  kind:    ${result.interaction.kind}`,
            `  contact: ${result.interaction.contactId ?? "-"}`,
            `  when:    ${result.interaction.occurredAt}`,
            `  subject: ${result.interaction.subject ?? "-"}`,
          ].join("\n");
        });
      },
    );

  cmd
    .command("delete")
    .description("Hard-delete an interaction (destructive, but undoable via action.undo)")
    .argument("<id>", "Interaction id (int_...)")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
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
          method: "DELETE";
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "DELETE", headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };
        const result = await apiRequest<{
          deletedId: string;
          snapshot: Interaction;
          dryRun: boolean;
          replayed: boolean;
          agentActionId: string | null;
        }>(cfg, `/v1/interactions/${id}`, reqOpts);
        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(would delete)" : "(deleted)";
          return [
            `${tag} ${result.deletedId}`,
            `  kind:    ${result.snapshot.kind}`,
            `  subject: ${result.snapshot.subject ?? "-"}`,
            result.agentActionId ? `  undo:    socrm action undo ${result.agentActionId}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        });
      },
    );

  cmd
    .command("ingest-email")
    .description(
      "Ingest a pre-parsed email. Body via flag or stdin. If sender is unknown, the contact is auto-created.",
    )
    .requiredOption("--from-email <email>")
    .option("--from-name <name>")
    .option("--subject <text>")
    .option("--body <text>", "Email body (use --body-stdin to pipe instead)")
    .option("--body-stdin", "Read body from stdin")
    .option("--received-at <iso>")
    .option("--message-id <id>")
    .option("--no-create", "Do not auto-create the contact if missing")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        fromEmail: string;
        fromName?: string;
        subject?: string;
        body?: string;
        bodyStdin?: boolean;
        receivedAt?: string;
        messageId?: string;
        create?: boolean;
        intent?: string;
        idempotencyKey?: string;
        dryRun?: boolean;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const bodyText = opts.bodyStdin ? await readStdin() : opts.body;
        const payload: Record<string, unknown> = {
          from: opts.fromName
            ? { email: opts.fromEmail, name: opts.fromName }
            : { email: opts.fromEmail },
          createContactIfMissing: opts.create !== false,
        };
        if (opts.subject) payload.subject = opts.subject;
        if (bodyText) payload.body = bodyText;
        if (opts.receivedAt) payload.receivedAt = opts.receivedAt;
        if (opts.messageId) payload.messageId = opts.messageId;

        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const reqOpts: {
          method: "POST";
          body: unknown;
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "POST", body: payload, headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };

        const result = await apiRequest<{
          interaction: Interaction;
          contact: Contact;
          identity: Identity;
          contactCreated: boolean;
          dryRun: boolean;
          replayed: boolean;
        }>(cfg, "/v1/interactions/ingest/email", reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun
            ? "(dry-run)"
            : result.replayed
              ? "(replayed)"
              : result.contactCreated
                ? "(ingested + new contact)"
                : "(ingested)";
          return [
            `${tag} ${result.interaction.id}`,
            `  from:    ${result.identity.value}`,
            `  contact: ${result.contact.id} (${result.contact.name})`,
            `  subject: ${result.interaction.subject ?? "-"}`,
          ].join("\n");
        });
      },
    );

  return cmd;
}
