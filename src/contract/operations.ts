import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  contactCreateInputSchema,
  contactUpdateInputSchema,
  contactListFiltersSchema,
} from "./schemas/contact.js";
import { identityAddInputSchema, identityFindInputSchema } from "./schemas/identity.js";
import {
  interactionCreateInputSchema,
  interactionListFiltersSchema,
  emailIngestInputSchema,
} from "./schemas/interaction.js";
import {
  dealCreateInputSchema,
  dealUpdateInputSchema,
  dealListFiltersSchema,
} from "./schemas/deal.js";
import {
  taskCreateInputSchema,
  taskUpdateInputSchema,
  taskListFiltersSchema,
} from "./schemas/task.js";
import {
  noteCreateInputSchema,
  noteUpdateInputSchema,
  noteListFiltersSchema,
} from "./schemas/note.js";
import {
  tagCreateInputSchema,
  tagUpdateInputSchema,
  tagAttachInputSchema,
} from "./schemas/tag.js";
import {
  contactImportCsvInputSchema,
  vcardIngestInputSchema,
  exportAccountFiltersSchema,
} from "./schemas/import-export.js";
import { accountUpdateInputSchema } from "@/domain/account.js";
import { apiKeyCreateInputSchema } from "@/domain/api-key.js";
import { reversibilityOf, type Reversibility } from "@/domain/action.js";
import { idSchema } from "./ids.js";

/**
 * The operation catalog is the agent-facing source of truth.
 * `schema.describe` returns this verbatim so an agent can bootstrap
 * itself with zero docs.
 */

export type OperationDescriptor = {
  operation: string;
  description: string;
  inputSchema: ReturnType<typeof zodToJsonSchema>;
  destructive: boolean;
  idempotent: boolean;
  supportsDryRun: boolean;
  supportsIntent: boolean;
  reversibility: Reversibility;
};

function withReversibility(ops: Omit<OperationDescriptor, "reversibility">[]): OperationDescriptor[] {
  return ops.map((o) => ({ ...o, reversibility: reversibilityOf(o.operation) }));
}

const contactIdInput = z.object({ id: idSchema("contact") });
const apiKeyIdInput = z.object({ id: idSchema("apiKey") });
const mergeInput = z.object({
  keepId: idSchema("contact"),
  mergeId: idSchema("contact"),
});

export function buildOperationCatalog(): OperationDescriptor[] {
  return withReversibility([
    {
      operation: "contact.create",
      description: "Create a new contact. Attaches email/phone Identities automatically.",
      inputSchema: zodToJsonSchema(contactCreateInputSchema, { name: "ContactCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "contact.get",
      description: "Fetch a contact and its identities by id.",
      inputSchema: zodToJsonSchema(contactIdInput, { name: "ContactGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "contact.list",
      description: "List contacts with cursor pagination, filters (status, q, updatedSince).",
      inputSchema: zodToJsonSchema(contactListFiltersSchema, { name: "ContactListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "contact.update",
      description:
        "Partially update a contact. Changing primaryEmail/primaryPhone attaches a new Identity.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("contact"), patch: contactUpdateInputSchema }),
        { name: "ContactUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "contact.delete",
      description:
        "Hard-delete a contact (cascade to identities). Snapshot stored in the agent action's metadata.",
      inputSchema: zodToJsonSchema(contactIdInput, { name: "ContactDeleteInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "contact.merge",
      description:
        "Merge mergeId into keepId. Migrates non-conflicting identities, then deletes the merge source.",
      inputSchema: zodToJsonSchema(mergeInput, { name: "ContactMergeInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "account.update",
      description: "Update the current account's name or email.",
      inputSchema: zodToJsonSchema(accountUpdateInputSchema, { name: "AccountUpdateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "api_key.create",
      description: "Issue a new API key. Plaintext token is returned exactly once.",
      inputSchema: zodToJsonSchema(apiKeyCreateInputSchema, { name: "ApiKeyCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "api_key.list",
      description: "List API keys for the current account.",
      inputSchema: zodToJsonSchema(
        z.object({ includeRevoked: z.boolean().optional() }),
        { name: "ApiKeyListInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "api_key.revoke",
      description: "Revoke an API key. The owning agent loses access on next request.",
      inputSchema: zodToJsonSchema(apiKeyIdInput, { name: "ApiKeyRevokeInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "action.list",
      description: "Read the agent audit log: who did what, when, with what intent.",
      inputSchema: zodToJsonSchema(
        z.object({
          limit: z.number().int().min(1).max(200).optional(),
          apiKeyId: z.string().optional(),
          targetKind: z.string().optional(),
          targetId: z.string().optional(),
        }),
        { name: "ActionListInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "identity.add",
      description:
        "Attach an additional channel identity (email, phone, telegram, whatsapp, linkedin, etc.) to a contact. The same value cannot belong to two contacts; merge first if needed.",
      inputSchema: zodToJsonSchema(identityAddInputSchema, { name: "IdentityAddInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "identity.remove",
      description: "Detach an identity from its contact. The contact itself is preserved.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("identity") }),
        { name: "IdentityRemoveInput" },
      ),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "identity.list",
      description: "List identities, optionally filtered by contact or kind.",
      inputSchema: zodToJsonSchema(
        z.object({
          contactId: idSchema("contact").optional(),
          kind: z.string().optional(),
        }),
        { name: "IdentityListInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "contact.find_by_identity",
      description:
        "Look up a single contact by one of its identities (email, phone, telegram, etc.). Returns the contact and the matched identity, or 404 if no match.",
      inputSchema: zodToJsonSchema(identityFindInputSchema, { name: "ContactFindInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "interaction.create",
      description: "Manually create an Interaction (call, meeting, note, message, etc.).",
      inputSchema: zodToJsonSchema(interactionCreateInputSchema, { name: "InteractionCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "interaction.list",
      description: "List interactions with cursor pagination and filters (contactId, kind, since).",
      inputSchema: zodToJsonSchema(interactionListFiltersSchema, { name: "InteractionListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "interaction.ingest_email",
      description:
        "Ingest a parsed email: finds the contact by sender email (or creates one), inserts an email Interaction, and returns everything linked. Pass createContactIfMissing:false to require an existing match.",
      inputSchema: zodToJsonSchema(emailIngestInputSchema, { name: "EmailIngestInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "interaction.delete",
      description: "Hard-delete an interaction. Snapshot kept in the audit log for undo.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("interaction") }), { name: "InteractionDeleteInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "action.get",
      description: "Fetch a single audit action by id, including its full metadata (snapshots).",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("agentAction") }), { name: "ActionGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "action.undo",
      description:
        "Reverse a previously-recorded action using the snapshot stored in its metadata. Works on operations marked reversibility:'reversible'. Returns CONFLICT for one-way operations (like contact.merge) or for action.undo itself.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("agentAction") }), { name: "ActionUndoInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── deals ───────────────────────────────────────────────
    {
      operation: "deal.create",
      description: "Create a new deal (revenue opportunity). Optionally tied to a contact.",
      inputSchema: zodToJsonSchema(dealCreateInputSchema, { name: "DealCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "deal.get",
      description: "Fetch a deal by id.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("deal") }), { name: "DealGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "deal.list",
      description: "List deals with cursor pagination and filters (contactId, stage, status).",
      inputSchema: zodToJsonSchema(dealListFiltersSchema, { name: "DealListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "deal.update",
      description: "Partially update a deal (title, stage, status, value, currency, expectedCloseDate, contact link).",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("deal"), patch: dealUpdateInputSchema }),
        { name: "DealUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "deal.delete",
      description: "Hard-delete a deal. Full row captured in audit log for undo.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("deal") }), { name: "DealDeleteInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── tasks ───────────────────────────────────────────────
    {
      operation: "task.create",
      description: "Create a task. Setting status=done auto-stamps completedAt. Tied to a contact and/or deal optionally.",
      inputSchema: zodToJsonSchema(taskCreateInputSchema, { name: "TaskCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "task.get",
      description: "Fetch a task by id.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("task") }), { name: "TaskGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "task.list",
      description: "List tasks with filters (contactId, dealId, status, priority, dueBefore).",
      inputSchema: zodToJsonSchema(taskListFiltersSchema, { name: "TaskListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "task.update",
      description: "Partially update a task. Transitioning status to/from 'done' auto-manages completedAt.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("task"), patch: taskUpdateInputSchema }),
        { name: "TaskUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "task.delete",
      description: "Hard-delete a task.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("task") }), { name: "TaskDeleteInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── notes ───────────────────────────────────────────────
    {
      operation: "note.create",
      description: "Create a note. Optionally attached to a contact, a deal, or standalone.",
      inputSchema: zodToJsonSchema(noteCreateInputSchema, { name: "NoteCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "note.get",
      description: "Fetch a note by id.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("note") }), { name: "NoteGetInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "note.list",
      description: "List notes filtered by contact or deal.",
      inputSchema: zodToJsonSchema(noteListFiltersSchema, { name: "NoteListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "note.update",
      description: "Partially update a note (body, title, link to contact or deal).",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("note"), patch: noteUpdateInputSchema }),
        { name: "NoteUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "note.delete",
      description: "Hard-delete a note.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("note") }), { name: "NoteDeleteInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── tags ────────────────────────────────────────────────
    {
      operation: "tag.create",
      description: "Create a tag (unique name per account, optional hex color).",
      inputSchema: zodToJsonSchema(tagCreateInputSchema, { name: "TagCreateInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "tag.list",
      description: "List all tags for the account.",
      inputSchema: zodToJsonSchema(z.object({}), { name: "TagListInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "tag.update",
      description: "Rename a tag or change its color.",
      inputSchema: zodToJsonSchema(
        z.object({ id: idSchema("tag"), patch: tagUpdateInputSchema }),
        { name: "TagUpdateInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "tag.delete",
      description:
        "Hard-delete a tag. Cascade-detaches from all contacts. Undo re-creates the tag AND re-attaches it to all previously linked contacts.",
      inputSchema: zodToJsonSchema(z.object({ id: idSchema("tag") }), { name: "TagDeleteInput" }),
      destructive: true,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "tag.attach",
      description: "Attach a tag to a contact. If already attached, returns a no-op with alreadyAttached:true.",
      inputSchema: zodToJsonSchema(tagAttachInputSchema, { name: "TagAttachInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "tag.detach",
      description: "Detach a tag from a contact.",
      inputSchema: zodToJsonSchema(tagAttachInputSchema, { name: "TagDetachInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    // ── import / export ─────────────────────────────────────
    {
      operation: "contact.import_csv",
      description:
        "Bulk-import contacts from a CSV. Auto-detects name/email/phone columns or use an explicit columnMap. onConflict:'skip' (default) leaves duplicates out, 'link' attaches the row's other identities to the existing contact. ONE AgentAction is emitted with the list of created ids; undoing it bulk-deletes everything created by the import.",
      inputSchema: zodToJsonSchema(contactImportCsvInputSchema, { name: "ContactImportCsvInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "contact.ingest_vcard",
      description:
        "Ingest a vCard. Looks up the contact by any of its EMAIL/TEL identities; creates one if missing (toggleable). Adds any new channel identities (linkedin, telegram, etc.) and returns everything linked. Reversible.",
      inputSchema: zodToJsonSchema(vcardIngestInputSchema, { name: "VCardIngestInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: true,
      supportsIntent: true,
    },
    {
      operation: "account.export",
      description:
        "Full or incremental JSON export of the account: contacts, identities, interactions, deals, tasks, notes, tags, links, and (optionally) the audit log. Pass since=ISO to export only rows modified after that timestamp.",
      inputSchema: zodToJsonSchema(exportAccountFiltersSchema, { name: "AccountExportInput" }),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
    {
      operation: "contact.export_csv",
      description: "Export contacts as CSV (id, name, primary_email, primary_phone, status, timestamps, identities concat).",
      inputSchema: zodToJsonSchema(
        z.object({
          status: z.string().optional(),
          since: z.string().datetime().optional(),
        }),
        { name: "ContactExportCsvInput" },
      ),
      destructive: false,
      idempotent: true,
      supportsDryRun: false,
      supportsIntent: false,
    },
  ]);
}

export function describeContract() {
  return {
    schemaVersion: "1",
    contract: {
      authentication: "Bearer API key (Authorization: Bearer crm_live_...)",
      envelope: { successKey: "data", errorKey: "error" },
      idempotencyHeader: "Idempotency-Key",
      intentHeader: "X-Agent-Intent",
      dryRunQueryParam: "dry_run",
      errorCodes: [
        "VALIDATION_FAILED",
        "IDEMPOTENCY_CONFLICT",
        "UNAUTHENTICATED",
        "INVALID_API_KEY",
        "NOT_FOUND",
        "CONFLICT",
        "RATE_LIMITED",
        "INTERNAL",
      ],
    },
    operations: buildOperationCatalog(),
    reversibilityValues: ["reversible", "one-way", "read-only"],
  };
}
