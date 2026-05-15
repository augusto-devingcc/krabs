import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, type OutputFormat } from "../output.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export function portabilityCommands(): {
  importCsv: Command;
  ingestVcard: Command;
  accountExport: Command;
  exportCsv: Command;
} {
  const importCsv = new Command("import-csv")
    .description("Bulk-import contacts from a CSV file or stdin")
    .option("--file <path>", "Path to CSV file (use --stdin to pipe instead)")
    .option("--stdin", "Read CSV from stdin")
    .option("--on-conflict <mode>", "skip|link", "skip")
    .option("--default-status <s>", "lead|prospect|customer|archived")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      let csv: string;
      if (opts.stdin) csv = await readStdin();
      else if (opts.file) csv = readFileSync(String(opts.file), "utf8");
      else throw new Error("--file or --stdin required");
      const body: Record<string, unknown> = { csv, onConflict: opts.onConflict };
      if (opts.defaultStatus) body.defaultStatus = opts.defaultStatus;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "POST"; body: unknown; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "POST",
        body,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{
        totalRows: number;
        created: number;
        linked: number;
        skipped: number;
        errors: number;
        agentActionId: string | null;
        dryRun: boolean;
      }>(cfg, "/v1/contacts/import", reqOpts);
      emit(r, pickFormat(opts.format), () => {
        const tag = r.dryRun ? "(dry-run)" : "(imported)";
        const lines = [
          `${tag} ${r.totalRows} rows: ${r.created} created, ${r.linked} linked, ${r.skipped} skipped, ${r.errors} errors`,
        ];
        if (r.agentActionId) lines.push(`  undo: socrm action undo ${r.agentActionId}`);
        return lines.join("\n");
      });
    });

  const ingestVcard = new Command("ingest-vcard")
    .description("Ingest a vCard file or stdin block (creates or links the contact, attaches identities)")
    .option("--file <path>")
    .option("--stdin")
    .option("--no-create", "Do not auto-create the contact if missing")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      let vcard: string;
      if (opts.stdin) vcard = await readStdin();
      else if (opts.file) vcard = readFileSync(String(opts.file), "utf8");
      else throw new Error("--file or --stdin required");
      const body: Record<string, unknown> = { vcard, createContactIfMissing: opts.create !== false };
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "POST"; body: unknown; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "POST",
        body,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{
        contact: { id: string; name: string };
        contactCreated: boolean;
        addedIdentityIds: string[];
        agentActionId: string | null;
        dryRun: boolean;
      }>(cfg, "/v1/contacts/ingest/vcard", reqOpts);
      emit(r, pickFormat(opts.format), () => {
        const tag = r.dryRun
          ? "(dry-run)"
          : r.contactCreated
            ? "(ingested + new contact)"
            : "(ingested + linked)";
        return [
          `${tag} ${r.contact.id} (${r.contact.name})`,
          `  added identities: ${r.addedIdentityIds.length}`,
          r.agentActionId ? `  undo: socrm action undo ${r.agentActionId}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      });
    });

  const accountExport = new Command("export")
    .description("Full or incremental JSON export of the account")
    .option("--since <iso>")
    .option("--no-actions", "Exclude the audit log")
    .option("--out <path>", "Write to file instead of stdout")
    .action(async (opts: { since?: string; actions?: boolean; out?: string }) => {
      const cfg = requireConfig();
      const query: Record<string, string> = {};
      if (opts.since) query.since = opts.since;
      if (opts.actions === false) query.include_actions = "0";
      const r = await apiRequest<unknown>(cfg, "/v1/account/export", { query });
      const text = JSON.stringify(r, null, 2);
      if (opts.out) {
        writeFileSync(opts.out, text + "\n", "utf8");
        process.stderr.write(`✔ wrote ${text.length} bytes to ${opts.out}\n`);
      } else {
        process.stdout.write(text + "\n");
      }
    });

  const exportCsv = new Command("export-csv")
    .description("Export contacts as CSV")
    .option("--status <s>")
    .option("--since <iso>")
    .option("--out <path>", "Write to file instead of stdout")
    .action(async (opts: { status?: string; since?: string; out?: string }) => {
      const cfg = requireConfig();
      const url = new URL("/v1/contacts/export.csv", cfg.apiUrl);
      if (opts.status) url.searchParams.set("status", opts.status);
      if (opts.since) url.searchParams.set("since", opts.since);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.token}` } });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const csv = await res.text();
      if (opts.out) {
        writeFileSync(opts.out, csv, "utf8");
        process.stderr.write(`✔ wrote ${csv.length} bytes to ${opts.out}\n`);
      } else {
        process.stdout.write(csv);
      }
    });

  return { importCsv, ingestVcard, accountExport, exportCsv };
}
