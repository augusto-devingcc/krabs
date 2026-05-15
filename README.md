# socrm — Solo Agentic CRM

Multi-tenant CRM built for solopreneurs in the AI era. One account per human; that human plus an unlimited number of their agents (Claude Code, Claude Desktop, Cursor, custom) are all first-class users.

Three equal-weight transports over a single contract:

- **CLI** (`socrm`) — for the human and for any agent with shell access
- **MCP server** — native plug-in for Claude Desktop, Claude Code, Cursor, etc.
- **HTTP API** — for everything else

See [`docs/architecture.md`](docs/architecture.md) for the full system design.

## Status

Phase 0 — foundations. Nothing usable yet.

## Development

Requires Node 22 and pnpm.

```bash
pnpm install
cp .env.example .env
pnpm db:generate    # create migration files from schema.ts
pnpm db:migrate     # apply migrations to local SQLite
pnpm db:seed        # create a test account + API key
pnpm dev            # start the API on :3000
pnpm test           # run tests
pnpm typecheck      # tsc --noEmit
```
