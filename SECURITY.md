# Security policy

## Reporting a vulnerability

Email `security@krabs.dev`. Do **not** open a public GitHub issue, post on social media, or share the details in Discord, Telegram, or any other channel before we have shipped a fix.

If you need to encrypt the report, request our PGP key in the first email and we will reply with the public key out-of-band.

Include in the report:

- A description of the vulnerability.
- Steps to reproduce, ideally with a minimal request or script.
- The version of krabs you tested against (`krabs --version`, or the commit SHA for self-host).
- Any impact assessment you've already done.

## What to expect

| step | timeline |
|---|---|
| Acknowledgement of receipt | within 24 hours |
| Initial triage and severity assessment | within 72 hours |
| Fix for critical issues deployed to hosted krabs | within 7 days |
| Public disclosure | after the fix is deployed and self-host users have had time to upgrade |

We will keep you updated through every stage and credit you in the release notes that disclose the fix, unless you prefer to stay anonymous.

## Scope

In scope:

- `api.krabs.dev`, `mcp.krabs.dev`, `app.krabs.dev`, `krabs.dev`
- The `krabs` CLI distributed through Homebrew and npm
- The code in this repository

Out of scope:

- Social engineering of staff or users
- Physical attacks against infrastructure
- Denial-of-service tests against production
- Findings in third-party services (Clerk, Turso, Vercel) — report those to the vendor

## Bounty

We do not run a formal bounty program at v0.x. Valid disclosures receive credit in the release notes and our gratitude. As the platform matures, we will revisit.
