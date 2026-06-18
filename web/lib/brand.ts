/**
 * Brand-level constants. Every user-visible mention of the product name lives
 * here. Renaming the product is a one-file change.
 *
 * Voice rules (from design system):
 *   - "krabs" / "krabs.dev" is always lowercase, even mid-sentence
 *   - Sentence case for headings, buttons, menus
 *   - Title Case reserved for proper nouns (Claude, MCP, HubSpot, …)
 */
export const BRAND = {
  name: "krabs",
  productName: "krabs.dev",
  headline: "The finance backend your AI agents operate.",
  tagline: "Income, expenses, cashflow. One contract, three transports.",
  description:
    "A self-hosted, open-source finance tracker your agents run over MCP, HTTP, and CLI. Every endpoint is a tool. Every tool returns JSON.",
  domain: "krabs.dev",
  repo: "https://github.com/augusto-devingcc/krabs",
  api: "api.krabs.dev",
  mcp: "mcp.krabs.dev",
  email: { support: "support@krabs.dev", security: "security@krabs.dev" },
} as const;
export type Brand = typeof BRAND;
