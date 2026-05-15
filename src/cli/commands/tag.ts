import { Command } from "commander";
import { requireConfig } from "../config.js";
import { apiRequest } from "../client.js";
import { emit, pickFormat, pad, type OutputFormat } from "../output.js";
import type { Tag } from "@/contract/schemas/tag.js";

export function tagCommand(): Command {
  const cmd = new Command("tag").description("Manage tags and contact tagging");

  cmd
    .command("create")
    .requiredOption("--name <name>")
    .option("--color <hex>", "#rrggbb")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const body: Record<string, unknown> = { name: opts.name };
      if (opts.color) body.color = opts.color;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const r = await apiRequest<{ tag: Tag }>(cfg, "/v1/tags", { method: "POST", body, headers });
      emit(r, pickFormat(opts.format), () => `(created) ${r.tag.id} ${r.tag.name}${r.tag.color ? ` ${r.tag.color}` : ""}`);
    });

  cmd
    .command("list")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const r = await apiRequest<{ items: Tag[] }>(cfg, "/v1/tags");
      emit(r, pickFormat(opts.format), () => {
        if (r.items.length === 0) return "(no tags)";
        const header = `${pad("ID", 32)} ${pad("NAME", 30)} COLOR`;
        return [header, ...r.items.map((t) => `${pad(t.id, 32)} ${pad(t.name, 30)} ${t.color ?? "-"}`)].join("\n");
      });
    });

  cmd
    .command("update")
    .argument("<id>")
    .option("--name <n>")
    .option("--color <hex>")
    .option("--clear-color")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const patch: Record<string, unknown> = {};
      if (opts.name) patch.name = opts.name;
      if (opts.clearColor) patch.color = null;
      else if (opts.color) patch.color = opts.color;
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "PATCH"; body: unknown; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "PATCH",
        body: patch,
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{ tag: Tag }>(cfg, `/v1/tags/${id}`, reqOpts);
      emit(r, pickFormat(opts.format), () => `(updated) ${r.tag.id} ${r.tag.name}`);
    });

  cmd
    .command("delete")
    .argument("<id>")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--dry-run")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (id: string, opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const reqOpts: { method: "DELETE"; headers: Record<string, string>; query?: Record<string, string> } = {
        method: "DELETE",
        headers,
      };
      if (opts.dryRun) reqOpts.query = { dry_run: "1" };
      const r = await apiRequest<{
        deletedId: string;
        snapshot: { contactIds: string[] };
        dryRun: boolean;
        agentActionId: string | null;
      }>(cfg, `/v1/tags/${id}`, reqOpts);
      emit(r, pickFormat(opts.format), () =>
        `${r.dryRun ? "(would delete)" : "(deleted)"} ${r.deletedId}\n  was attached to ${r.snapshot.contactIds.length} contact(s)`,
      );
    });

  cmd
    .command("attach")
    .description("Attach a tag to a contact")
    .requiredOption("--contact <id>")
    .requiredOption("--tag <id>")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const r = await apiRequest<{ alreadyAttached: boolean; contactId: string; tagId: string }>(
        cfg,
        "/v1/tags/attach",
        { method: "POST", body: { contactId: opts.contact, tagId: opts.tag }, headers },
      );
      emit(r, pickFormat(opts.format), () =>
        r.alreadyAttached ? `(already attached) ${r.contactId} ↔ ${r.tagId}` : `(attached) ${r.contactId} ↔ ${r.tagId}`,
      );
    });

  cmd
    .command("detach")
    .description("Detach a tag from a contact")
    .requiredOption("--contact <id>")
    .requiredOption("--tag <id>")
    .option("--intent <t>")
    .option("--idempotency-key <k>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (opts: Record<string, unknown> & { format: OutputFormat }) => {
      const cfg = requireConfig();
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
      if (opts.intent) headers["X-Agent-Intent"] = String(opts.intent);
      const r = await apiRequest<{ wasAttached: boolean; contactId: string; tagId: string }>(
        cfg,
        "/v1/tags/detach",
        { method: "POST", body: { contactId: opts.contact, tagId: opts.tag }, headers },
      );
      emit(r, pickFormat(opts.format), () =>
        r.wasAttached ? `(detached) ${r.contactId} ⊘ ${r.tagId}` : `(was not attached) ${r.contactId} ⊘ ${r.tagId}`,
      );
    });

  cmd
    .command("for-contact")
    .argument("<contactId>")
    .option("--format <format>", "json|table|auto", "auto")
    .action(async (cid: string, opts: { format: OutputFormat }) => {
      const cfg = requireConfig();
      const r = await apiRequest<{ items: Tag[] }>(cfg, `/v1/tags/for-contact/${cid}`);
      emit(r, pickFormat(opts.format), () =>
        r.items.length === 0 ? "(no tags)" : r.items.map((t) => `${t.id} ${t.name}`).join("\n"),
      );
    });

  return cmd;
}
