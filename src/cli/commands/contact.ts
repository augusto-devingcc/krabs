import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import { portabilityCommands } from "./portability.js";
import type { Contact, ContactUpdateInput } from "../../contract/schemas/contact.js";
import type { Identity } from "../../contract/schemas/identity.js";

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

  cmd
    .command("list")
    .description("List contacts with cursor pagination and filters")
    .option("--limit <n>", "Max items (1-200)", (v) => Number(v))
    .option("--cursor <cursor>", "Continuation cursor")
    .option("--status <status>", "lead|prospect|customer|archived")
    .option("--q <query>", "Search across name/email/phone")
    .option("--updated-since <iso>", "Only contacts updated at or after this ISO timestamp")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        limit?: number;
        cursor?: string;
        status?: string;
        q?: string;
        updatedSince?: string;
        format: OutputFormat;
      }) => {
        const cfg = requireConfig();
        const query: Record<string, string | number> = {};
        if (opts.limit) query.limit = opts.limit;
        if (opts.cursor) query.cursor = opts.cursor;
        if (opts.status) query.status = opts.status;
        if (opts.q) query.q = opts.q;
        if (opts.updatedSince) query.updated_since = opts.updatedSince;
        const result = await apiRequest<{ items: Contact[]; nextCursor: string | null }>(
          cfg,
          "/v1/contacts",
          { query },
        );
        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          if (result.items.length === 0) return "(no contacts)";
          const header = `${pad("ID", 32)} ${pad("STATUS", 10)} ${pad("NAME", 30)} EMAIL`;
          const rows = result.items.map(
            (c) => `${pad(c.id, 32)} ${pad(c.status, 10)} ${pad(c.name, 30)} ${c.primaryEmail ?? "-"}`,
          );
          const lines = [header, ...rows];
          if (result.nextCursor) lines.push(`\nnext: --cursor ${result.nextCursor}`);
          return lines.join("\n");
        });
      },
    );

  cmd
    .command("update")
    .description("Partially update a contact")
    .argument("<id>", "Contact id (cnt_...)")
    .option("--name <name>")
    .option("--email <email>", "New primary email (use --clear-email to remove)")
    .option("--phone <phone>", "New primary phone (use --clear-phone to remove)")
    .option("--clear-email", "Set primaryEmail to null")
    .option("--clear-phone", "Set primaryPhone to null")
    .option("--status <status>", "lead|prospect|customer|archived")
    .option("--custom-fields <json>", "JSON object")
    .option("--intent <text>", "Free-text intent (audit log)")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (
        id: string,
        opts: {
          name?: string;
          email?: string;
          phone?: string;
          clearEmail?: boolean;
          clearPhone?: boolean;
          status?: ContactUpdateInput["status"];
          customFields?: string;
          intent?: string;
          idempotencyKey?: string;
          dryRun?: boolean;
          format: OutputFormat;
        },
      ) => {
        const cfg = requireConfig();
        const patch: Record<string, unknown> = {};
        if (opts.name !== undefined) patch.name = opts.name;
        if (opts.clearEmail) patch.primaryEmail = null;
        else if (opts.email !== undefined) patch.primaryEmail = opts.email;
        if (opts.clearPhone) patch.primaryPhone = null;
        else if (opts.phone !== undefined) patch.primaryPhone = opts.phone;
        if (opts.status) patch.status = opts.status;
        if (opts.customFields) patch.customFields = JSON.parse(opts.customFields);

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
          contact: Contact;
          before: Contact;
          dryRun: boolean;
          replayed: boolean;
          agentActionId: string | null;
        }>(cfg, `/v1/contacts/${id}`, reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(dry-run)" : result.replayed ? "(replayed)" : "(updated)";
          return [
            `${tag} ${result.contact.id}`,
            `  name:   ${result.before.name} → ${result.contact.name}`,
            `  email:  ${result.before.primaryEmail ?? "-"} → ${result.contact.primaryEmail ?? "-"}`,
            `  phone:  ${result.before.primaryPhone ?? "-"} → ${result.contact.primaryPhone ?? "-"}`,
            `  status: ${result.before.status} → ${result.contact.status}`,
          ].join("\n");
        });
      },
    );

  cmd
    .command("delete")
    .description("Hard-delete a contact (cascades to identities). Snapshot kept in audit log.")
    .argument("<id>", "Contact id (cnt_...)")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run", "Show what would be deleted without doing it")
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
          deletedId: string;
          snapshot: { contact: Contact; identities: Identity[] };
          dryRun: boolean;
          replayed: boolean;
          agentActionId: string | null;
        }>(cfg, `/v1/contacts/${id}`, reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(would delete)" : result.replayed ? "(replayed)" : "(deleted)";
          return [
            `${tag} ${result.deletedId}`,
            `  name:        ${result.snapshot.contact.name}`,
            `  identities:  ${result.snapshot.identities.length}`,
            result.agentActionId ? `  action:      ${result.agentActionId}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        });
      },
    );

  cmd
    .command("find")
    .description("Look up a contact by one of its identities (email/phone/telegram/etc.)")
    .requiredOption("--kind <kind>")
    .requiredOption("--value <value>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { kind: string; value: string; format: OutputFormat }) => {
      const cfg = requireConfig();
      const result = await apiRequest<{ contact: Contact; identity: Identity }>(
        cfg,
        "/v1/contacts/find",
        { query: { kind: opts.kind, value: opts.value } },
      );
      const fmt = pickFormat(opts.format);
      emit(result, fmt, () =>
        [
          `${result.contact.id} (${result.contact.name})`,
          `  matched: ${result.identity.kind} = ${result.identity.value}`,
          `  email:   ${result.contact.primaryEmail ?? "-"}`,
          `  phone:   ${result.contact.primaryPhone ?? "-"}`,
        ].join("\n"),
      );
    });

  cmd
    .command("merge")
    .description("Merge mergeId into keepId (combines identities, deletes mergeId)")
    .requiredOption("--keep <id>", "Contact id to keep")
    .requiredOption("--from <id>", "Contact id to merge from (will be deleted)")
    .option("--intent <text>")
    .option("--idempotency-key <key>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(
      async (opts: {
        keep: string;
        from: string;
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
        } = {
          method: "POST",
          body: { keepId: opts.keep, mergeId: opts.from },
          headers,
        };
        if (opts.dryRun) reqOpts.query = { dry_run: "1" };

        const result = await apiRequest<{
          kept: Contact;
          mergedFrom: Contact;
          migratedIdentities: Identity[];
          skippedIdentities: Identity[];
          dryRun: boolean;
        }>(cfg, "/v1/contacts/merge", reqOpts);

        const fmt = pickFormat(opts.format);
        emit(result, fmt, () => {
          const tag = result.dryRun ? "(would merge)" : "(merged)";
          return [
            `${tag} ${result.mergedFrom.id} → ${result.kept.id}`,
            `  migrated identities: ${result.migratedIdentities.length}`,
            `  skipped (duplicate): ${result.skippedIdentities.length}`,
          ].join("\n");
        });
      },
    );

  const portability = portabilityCommands();
  cmd.addCommand(portability.importCsv);
  cmd.addCommand(portability.ingestVcard);
  cmd.addCommand(portability.exportCsv);

  return cmd;
}
