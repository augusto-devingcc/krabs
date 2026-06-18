# krabs

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-black" />
  <img alt="node" src="https://img.shields.io/badge/node-22+-black" />
</p>

A **personal finance tracker** — income, expenses, cashflow — designed to be operated by AI agents, not humans clicking through pages. Products, subscriptions, invoices, expenses, and finance reporting (MRR/ARR, net, ROAS) reachable over three equally first-class transports: MCP, CLI, and HTTP. Every mutation is idempotent, dry-runnable, and lands in an append-only audit log alongside the intent that caused it.

Self-host. No login. No web dashboard. No billing.

## Why

Existing finance tools assume the operator is a human reading forms. krabs assumes the operator is a model. Endpoints are verb-noun (`invoice.create`, `expense.create`, `finance.summary`). The full contract is machine-readable at `/v1/schema`. Mutations accept `Idempotency-Key` and `dry_run`. The model reads its own manual, retries safely, and previews before writing.

## Three doors. Same primitives.

| transport | for |
|---|---|
| `MCP` | agentic hosts — Claude Desktop, Cursor, Claude Code |
| `CLI` (`krabs`) | shell-driven agents, humans, scripts |
| `HTTP` (`/v1/*`) | everything else — n8n, cron, your own scripts |

The same operation. The same response shape. The same object graph behind it.

## Primitives

- **products** — plans/offerings (saas, service, retainer, one-time…), money in integer cents
- **subscriptions** — recurring income, MRR denormalized for O(1) aggregates; `counterparty` is a free-text payer name
- **invoices** — one-off income, auto-numbered `INV-YYYY-NNNN`, draft → sent → paid lifecycle
- **expenses** — categorized outflows (ads, infra, contractor, software, tax…), dedup-able by source ref
- **finance** — `summary` (revenue/expenses/net/MRR/ARR), `mrr` breakdown, `expenses-by-category`, `funnel` (ROAS)

## Self-host quickstart

```bash
git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
cp .env.example .env.local
pnpm install
pnpm setup            # creates the local DB + a single API key, writes MCP config
pnpm dev:api          # starts the Hono API on :3000 (in another terminal)
```

`pnpm setup` runs the migrations, mints one API key (saved to `~/.config/krabs/config.json`), and prints an MCP config snippet to paste into Claude Desktop / Cursor.

Then:

```bash
krabs schema describe
krabs finance summary
```

## The contract

Every operation:

1. **Intent.** Verb-noun endpoints (`invoice.create`, `expense.create`). Pass `X-Agent-Intent` to annotate the audit log.
2. **Idempotency.** Every mutation accepts an `Idempotency-Key`. Retries are safe.
3. **Dry-run.** Every mutation accepts `dry_run=1`. Returns a plan, writes nothing.
4. **Schema introspection.** `GET /v1/schema` returns the full contract.
5. **Audit.** Every write lands in an append-only log; account/api-key mutations are reversible via `action.undo`.

## Tech stack

- **Runtime:** Node 22+, Hono (the API)
- **DB:** libSQL via Drizzle ORM (local SQLite file, or remote Turso)
- **CLI:** Node, commander, bundled with tsdown into single-file binaries
- **MCP:** `@modelcontextprotocol/sdk` streamable HTTP transport at `/v1/mcp`

## Repository layout

```
src/
├── api/          ← Hono routes + middleware
├── domain/       ← business logic (products, subscriptions, invoices, expenses, finance, action, api-key, account)
├── db/           ← Drizzle schema + migrations
├── cli/          ← CLI command implementations (source)
├── mcp/          ← MCP server + tools
├── contract/     ← operation catalog, Zod schemas, id prefixes, error types
└── lib/          ← shared utilities (hash, logger)
cli/              ← publishable npm package (wraps src/cli)
```

## Contributing

PRs welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md). Security disclosures: see [SECURITY.md](./SECURITY.md) — do **not** open a public issue.

## License

[MIT](./LICENSE). © 2026 Augusto García.
