import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { ApiError } from "../../contract/errors.js";
import { createMcpServer } from "../../mcp/tools.js";

export const mcpRoute = new Hono();

mcpRoute.use("*", apiKeyAuth);

// Stateless mode: each HTTP request gets its own McpServer + transport.
// MCP tools loop back into our own /v1/* via apiRequest using the same bearer
// token the client sent; the upstream URL is derived from the inbound origin
// so the same code path works for localhost dev and api.krabs.dev in prod.
async function handle(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Missing Authorization header",
      hint: "Send 'Authorization: Bearer krabs_sk_…'",
    });
  }
  const token = authHeader.slice(7).trim();

  const url = new URL(req.url);
  const apiUrl = `${url.protocol}//${url.host}`;

  const server = createMcpServer({ apiUrl, token });
  // No sessionIdGenerator => stateless mode (the property must be omitted, not
  // set to undefined, because of exactOptionalPropertyTypes).
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

mcpRoute.all("/", async (c) => handle(c.req.raw));
