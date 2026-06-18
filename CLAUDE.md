# CLAUDE.md — krabs codebase guide

You are working on **krabs** — a **personal finance tracker** (income / expenses / cashflow) designed to be operated by AI agents, not humans. Primitives: products, subscriptions, invoices, expenses, plus finance reporting. Reachable over MCP + CLI + HTTP, with idempotent + dry-runnable mutations and an append-only audit log.

It is **self-host, open source (MIT), no login, no web dashboard, no billing.** There is a single internal account seeded by `pnpm setup`; multi-tenant plumbing (`accountId` columns, `CallerContext`) is retained but there is no platform surface exposing it.

The user (Augusto García, `augusto@realtialabs.com`) is the founder and only contributor.

---

## Architecture at a glance

| Layer | Where | What |
|---|---|---|
| Hono API | `src/api/` | The agent-facing contract. `server.ts` runs standalone; `app.ts` builds the app; `routes/` has per-domain routers; `middleware/auth.ts` resolves bearer API-key tokens; `middleware/error.ts` formats `ApiError`. |
| Domain | `src/domain/` | One file per concern: `product.ts`, `subscription.ts`, `invoice.ts`, `expense.ts`, `finance.ts`, `finance-utils.ts`, `action.ts` (audit + undo), `api-key.ts`, `account.ts`. `shared.ts` has `buildAction()` + idempotency helpers. |
| Database | `src/db/` | `schema.ts` is the Drizzle source of truth. `migrations/` is generated — never hand-edit. `client.ts` opens libSQL. |
| Contract | `src/contract/` | `errors.ts` (`ApiError`, envelope), `ids.ts` (`newId('invoice')` etc.), `operations.ts` (the `/v1/schema` catalog), `schemas/` (account, api-key, agent-action). |
| MCP server | `src/mcp/` | `tools.ts` registers finance + account + api-key + audit tools; mounted at `/v1/mcp`. |
| CLI | `cli/` + `src/cli/` | `src/cli/` is the source; `cli/` is the publishable npm package (own `package.json`, builds `../src/cli/main.ts` via tsup). Root builds all three entries via tsdown. |
| Tests | `tests/` | Vitest. `api.test.ts` (health/auth/me), `finance.test.ts` (products→subscriptions→invoices→expenses→reporting→audit). |

### Three doors, same primitives

`MCP`, `CLI` (`krabs`), `HTTP` all funnel through the same Hono app and the same domain functions. If you add a new mutation, expose it on all three (route + MCP tool + operation-catalog entry; CLI if it warrants a command).

---

## Backend — operating principles

- **Errors**: always throw `ApiError({ code, message, hint? })`. `src/api/middleware/error.ts` wraps it into `{ error: { code, message, hint? }, _schema_version: "1" }`. Don't `c.json({ error: "..." }, 404)`.
- **IDs**: use `newId('invoice')`, `newId('expense')`, etc. from `src/contract/ids.ts`. Prefixes: `acc`, `key`, `act`, `idem`, `prd`, `sub`, `inv`, `exp`.
- **Audit**: every mutation inserts an `agent_actions` row via `buildAction()` from `src/domain/shared.ts`. The audit log is the agentic differentiator — losing rows is a regression.
- **Idempotency**: mutations accept `Idempotency-Key`. Helpers in `src/domain/shared.ts` / `src/contract/`.
- **Undo**: `src/domain/action.ts` exposes `action.undo` for reversible ops (currently `account.update`, `api_key.create`, `api_key.revoke`). Finance ops are recorded but not undo-able (treated as one-way) — add a dispatcher in `action.ts` if you want to change that.
- **Multi-tenancy**: every domain function takes `ctx: CallerContext = { accountId, apiKeyId }` and every query filters by `accountId`. Keep it even though there's one account — it's cheap and removing it is risky.
- **Money**: integer cents everywhere. Currency defaults to `USD` per row.
- **Counterparty**: subscriptions and invoices have an optional free-text `counterparty` (payer name). There is no contact graph — don't reintroduce one.

---

## Tooling

```bash
pnpm dev:api          # standalone Hono on :3000
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
pnpm build:cli        # tsdown → dist/{api,cli,mcp}
pnpm db:generate      # drizzle-kit generate (after a schema.ts edit)
pnpm db:migrate       # apply pending migrations
pnpm db:seed          # seed a dev account + key
pnpm setup            # one-shot local bootstrap (account + API key + MCP config)
```

### gotchas

- After editing `src/db/schema.ts`, run `pnpm db:generate`. Migrations are generated; don't hand-edit.
- `cli/` is its own pnpm context (`.npmrc` has `ignore-workspace=true`). It bundles `../src/cli/main.ts`.
- CI (`.github/workflows/ci.yml`) does `mkdir -p ./data` before builds because libSQL won't create the parent dir for `file:./data/*.db`.

---

## Stripe / integrations

There is **no Stripe or Resend integration**. They were removed during the CRM→finance strip-down (the per-account encrypted credential flow was too entangled to keep safely for a single-account self-host tool). If income should mirror from Stripe later, do it as a thin webhook that reads the self-hoster's own `KRABS_STRIPE_SECRET_KEY` from env and writes invoices/subscriptions for the single account — do **not** reintroduce a per-account `integrations` table or AES credential vault.

---

## Working with the user

- **Channels**: the user reads **Discord** and **Telegram**, not the terminal. Send status updates via the Discord/Telegram reply tools.
- **Language**: Spanish latinoamericano neutro (`tú`, `puedes`, `quieres`). Never rioplatense.
- **Decision style**: he picks fast and trusts judgment. For non-trivial scope, give the trade-off in 2-3 sentences and a recommendation.
- **He pushes back on**: tests that mock too much; backwards-compat shims nobody reads; comments that paraphrase code; over-engineered abstractions. Default to surgical edits.

## Don't

- Don't push to `main` without the user's explicit `dale` / `go` / `ok push`.
- Don't reintroduce the web frontend, CRM primitives (contacts/deals/tasks/notes/tags), Clerk, or billing.
- Don't run `git reset --hard`, `git push --force`, or `--no-verify` unless asked.
- Don't write multi-paragraph docstrings. One line max, only when the WHY is non-obvious.
