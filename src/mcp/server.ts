#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { contactStatuses } from "@/db/schema.js";
import { apiRequest, ApiClientError } from "@/cli/client.js";

const DEFAULT_API_URL = "http://localhost:3000";

function getConfig(): { apiUrl: string; token: string } {
  const token = process.env.SOCRM_API_KEY;
  if (!token) {
    throw new Error("SOCRM_API_KEY environment variable is required");
  }
  return {
    apiUrl: process.env.SOCRM_API_URL ?? DEFAULT_API_URL,
    token,
  };
}

const contactCreateInput = {
  name: z.string().describe("Contact's full name"),
  email: z.string().email().optional().describe("Primary email"),
  phone: z.string().optional().describe("Primary phone"),
  status: z.enum(contactStatuses).optional().describe("Contact status (default: lead)"),
  intent: z
    .string()
    .optional()
    .describe(
      "Free-text describing why you are creating this contact. Recorded in the audit log for the human owner to review.",
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe("If you retry this call with the same key, the original result is returned without creating a duplicate."),
  dryRun: z
    .boolean()
    .optional()
    .describe("If true, the operation is computed but not persisted."),
};

const contactGetInput = {
  id: z
    .string()
    .regex(/^cnt_[0-9A-HJKMNP-TV-Z]{26}$/)
    .describe("Contact id, e.g. cnt_01HZ..."),
};

function textResult(value: unknown): {
  content: { type: "text"; text: string }[];
  isError?: boolean;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(err: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  let payload: { code: string; message: string; hint?: string; field?: string };
  if (err instanceof ApiClientError) {
    payload = { code: err.code, message: err.message };
    if (err.hint) payload.hint = err.hint;
    if (err.field) payload.field = err.field;
  } else {
    payload = { code: "INTERNAL", message: err instanceof Error ? err.message : String(err) };
  }
  return {
    content: [{ type: "text", text: JSON.stringify({ error: payload }, null, 2) }],
    isError: true,
  };
}

async function main() {
  const cfg = getConfig();

  const server = new McpServer(
    { name: "socrm", version: "0.0.1" },
    {
      capabilities: { tools: {} },
      instructions:
        "Solo Agentic CRM. Tools mutate the user's CRM data. Every mutation is recorded in the audit log with the API key acting as the actor; pass 'intent' to leave a human-readable note explaining what you were trying to accomplish.",
    },
  );

  server.registerTool(
    "contact_create",
    {
      title: "Create contact",
      description: "Create a new contact in the CRM. Returns the created contact and any identities (email, phone) attached.",
      inputSchema: contactCreateInput,
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { name: args.name };
        if (args.email) body.email = args.email;
        if (args.phone) body.phone = args.phone;
        if (args.status) body.status = args.status;

        const headers: Record<string, string> = {};
        if (args.idempotencyKey) headers["Idempotency-Key"] = args.idempotencyKey;
        if (args.intent) headers["X-Agent-Intent"] = args.intent;

        const reqOpts: {
          method: "POST";
          body: unknown;
          headers: Record<string, string>;
          query?: Record<string, string>;
        } = { method: "POST", body, headers };
        if (args.dryRun) reqOpts.query = { dry_run: "1" };

        const data = await apiRequest<unknown>(cfg, "/v1/contacts", reqOpts);
        return textResult(data);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "contact_get",
    {
      title: "Get contact",
      description: "Fetch a contact by id, including all attached identities.",
      inputSchema: contactGetInput,
    },
    async (args) => {
      try {
        const data = await apiRequest<unknown>(cfg, `/v1/contacts/${args.id}`);
        return textResult(data);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "action_list",
    {
      title: "List agent actions",
      description: "Inspect what agents (including you) have done in this CRM. Use to audit recent activity.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
        apiKeyId: z.string().optional(),
        targetKind: z.string().optional(),
        targetId: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const query: Record<string, string | number> = {};
        if (args.limit) query.limit = args.limit;
        if (args.apiKeyId) query.api_key_id = args.apiKeyId;
        if (args.targetKind) query.target_kind = args.targetKind;
        if (args.targetId) query.target_id = args.targetId;
        const data = await apiRequest<unknown>(cfg, "/v1/actions", { query });
        return textResult(data);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`socrm-mcp fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
