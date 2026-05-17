#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./tools.js";

const DEFAULT_API_URL = "https://api.krabs.dev";

function getConfig(): { apiUrl: string; token: string } {
  const token = process.env.KRABS_API_KEY;
  if (!token) {
    throw new Error("KRABS_API_KEY environment variable is required");
  }
  return {
    apiUrl: process.env.KRABS_API_URL ?? DEFAULT_API_URL,
    token,
  };
}

async function main() {
  const cfg = getConfig();
  const server = createMcpServer(cfg);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`krabs-mcp fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
