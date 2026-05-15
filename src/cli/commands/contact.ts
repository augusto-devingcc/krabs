import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { Contact } from "@/contract/schemas/contact.js";
import type { Identity } from "@/contract/schemas/identity.js";

type CreateOpts = {
  name: string;
  email?: string;
  phone?: string;
  status?: "lead" | "prospect" | "customer" | "archived";
  intent?: string;
  idempotencyKey?: string;
  dryRun?: boolean;
  format: OutputFormat;
};

type CreateResult = {
  contact: Contact;
  identities: Identity[];
  agentActionId: string | null;
  dryRun: boolean;
  replayed: boolean;
};

export function contactCommand(): Command {
  const cmd = new Command("contact").description("Manage contacts");

  cmd
    .command("create")
    .description("Create a new contact")
    .requiredOption("--name <name>", "Contact name")
    .option("--email <email>", "Primary email")
    .option("--phone <phone>", "Primary phone")
    .option("--status <status>", "lead|prospect|customer|archived")
    .option("--intent <text>", "Free-text intent (recorded in audit log)")
    .option("--idempotency-key <key>", "Idempotency key for safe retries")
    .option("--dry-run", "Compute the result without persisting")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: CreateOpts) => {
      const cfg = requireConfig();

      const body: Record<string, unknown> = { name: opts.name };
      if (opts.email) body.email = opts.email;
      if (opts.phone) body.phone = opts.phone;
      if (opts.status) body.status = opts.status;

      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
      if (opts.intent) headers["X-Agent-Intent"] = opts.intent;

      const reqOpts: {
        method: "POST";
        body: unknown;
        headers: Record<string, string>;
        query?: Record<string, string>;
      } = {
        method: "POST",
        body,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };

      const result = await apiRequest<CreateResult>(cfg, "/v1/contacts", reqOpts);

      const fmt = pickFormat(opts.format);
      emit(result, fmt, () => {
        const tag = result.dryRun
          ? "(dry-run)"
          : result.replayed
            ? "(replayed)"
            : "(created)";
        const lines = [
          `${tag} ${result.contact.id}`,
          `  name:   ${result.contact.name}`,
          `  email:  ${result.contact.primaryEmail ?? "-"}`,
          `  phone:  ${result.contact.primaryPhone ?? "-"}`,
          `  status: ${result.contact.status}`,
        ];
        if (result.identities.length > 0) {
          lines.push("  identities:");
          for (const id of result.identities) {
            lines.push(`    ${pad(id.kind, 10)} ${id.value}`);
          }
        }
        if (result.agentActionId) {
          lines.push(`  action: ${result.agentActionId}`);
        }
        return lines.join("\n");
      });
    });

  cmd
    .command("get")
    .description("Fetch a contact by id")
    .argument("<id>", "Contact id (cnt_...)")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest<{ contact: Contact; identities: Identity[] }>(
        cfg,
        `/v1/contacts/${id}`,
      );
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () => {
        const c = result.contact;
        const lines = [
          c.id,
          `  name:   ${c.name}`,
          `  email:  ${c.primaryEmail ?? "-"}`,
          `  phone:  ${c.primaryPhone ?? "-"}`,
          `  status: ${c.status}`,
        ];
        if (result.identities.length > 0) {
          lines.push("  identities:");
          for (const idt of result.identities) {
            lines.push(`    ${pad(idt.kind, 10)} ${idt.value}`);
          }
        }
        return lines.join("\n");
      });
    });

  return cmd;
}
