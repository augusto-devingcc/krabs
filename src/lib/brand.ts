/**
 * Brand-level constants. Every user-visible mention of the product name lives
 * here. Renaming the product is a one-file change.
 */
export const BRAND = {
  name: "socrm",
  headline: "The default backend for AI agents running businesses.",
  tagline: "One contract. Three transports. Total agent control.",
  description:
    "Multi-tenant CRM built for solopreneurs whose agents do the work. CLI, MCP, and HTTP equally first-class.",
  domain: "socrm.dev",
  email: { support: "support@socrm.dev", security: "security@socrm.dev" },
} as const;
export type Brand = typeof BRAND;
