import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  contactCreateInputSchema,
  contactUpdateInputSchema,
  contactListFiltersSchema,
} from "./schemas/contact.js";
import { accountUpdateInputSchema } from "@/domain/account.js";
import { apiKeyCreateInputSchema } from "@/domain/api-key.js";
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
};

const contactIdInput = z.object({ id: idSchema("contact") });
const apiKeyIdInput = z.object({ id: idSchema("apiKey") });
const mergeInput = z.object({
  keepId: idSchema("contact"),
  mergeId: idSchema("contact"),
});

export function buildOperationCatalog(): OperationDescriptor[] {
  return [
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
  ];
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
  };
}
