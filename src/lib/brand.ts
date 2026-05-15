/**
 * Brand-level constants. Every user-visible mention of the product name lives
 * here. Renaming the product is a one-file change.
 */
export const BRAND = {
  name: "socrm",
  tagline: "A CRM your agents can fully drive.",
  description:
    "Multi-tenant CRM built for solopreneurs in the AI era. Three transports, one contract, total agent control with an actionable audit log.",
  domain: "socrm.dev",
  email: {
    support: "support@socrm.dev",
    security: "security@socrm.dev",
  },
} as const;

export type Brand = typeof BRAND;
