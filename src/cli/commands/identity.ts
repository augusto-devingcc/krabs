import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { Identity } from "../../contract/schemas/identity.js";
import type { Contact } from "../../contract/schemas/contact.js";

export function identityCommand(): Command {
  const cmd = new Command("identity").description("Manage channel identities attached to contacts");

  cmd
    .command("add")
    .description("Attach an additional identity (email/phone/telegram/etc.) to a contact")
    .requiredOption("--contact <id>", "Contact id (cnt_...)")
    .requiredOption("--kind <kind>", "email|phone|whatsapp|telegram|linkedin|twitter|instagram|other")
    .requiredOption("--value <value>", "The identity value")
    .option("--confidence <n>", "0-100 (default 100)", (v) => Number(v))
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        contact: string;
        kind: string;
        value: string;
        confidence?: number;
        intent?: string;
        idempotencyKey?: string;
        dryRun?: boolean;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const body: Record<string, unknown> = {
          contactId: opts.contact,
          kind: opts.kind,
          value: opts.value,
        };
        if (opts.confidence !== undefined) body.confidence = opts.confidence;
        const headers: Record<string, string> = {};
        if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
        if (opts.intent) headers["X-Agent-Intent"] = opts.intent;
        const reqOpts: {
          method: "POST";
          body: unknown;
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "POST", body, headers };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };

        const result = await apiRequest<{
          identity: Identity;
          contact: Contact;
          dryRun: boolean;
          replayed: boolean;
        }>(cfg, "/v1/identities", reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(dry-run)" : result.replayed ? "(replayed)" : "(added)";
          return [
            `${tag} ${result.identity.id}`,
            `  contact: ${result.contact.id} (${result.contact.name})`,
            `  ${result.identity.kind}: ${result.identity.value}`,
          ].join("\n");
        });
      },
    );

  cmd
    .command("remove")
    .description("Detach an identity from its contact (destructive)")
    .argument("<id>", "Identity id (idy_...)")
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
          removedIdentity: Identity;
          dryRun: boolean;
          replayed: boolean;
        }>(cfg, `/v1/identities/${id}`, reqOpts);
        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(would remove)" : "(removed)";
          return `${tag} ${result.removedIdentity.id}  ${result.removedIdentity.kind}: ${result.removedIdentity.value}`;
        });
      },
    );

  cmd
    .command("list")
    .description("List identities (filter by contact or kind)")
    .option("--contact <id>", "Filter by contact id")
    .option("--kind <kind>", "Filter by kind")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { contact?: string; kind?: string; format: OutputFormat }) => {
      const cfg = requireConfig();
      const query: Record<string, string> = {};
      if (opts.contact) query.contact_id = opts.contact;
      if (opts.kind) query.kind = opts.kind;
      const result = await apiRequest<{ items: Identity[] }>(cfg, "/v1/identities", { query });
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () => {
        if (result.items.length === 0) return "(no identities)";
        const header = `${pad("ID", 32)} ${pad("KIND", 12)} ${pad("VALUE", 40)} CONTACT`;
        const rows = result.items.map(
          (i) => `${pad(i.id, 32)} ${pad(i.kind, 12)} ${pad(i.value, 40)} ${i.contactId}`,
        );
        return [header, ...rows].join("\n");
      });
    });

  return cmd;
}
