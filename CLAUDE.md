# CLAUDE.md — krabs.dev codebase guide

You are working on **krabs.dev** — a multi-tenant CRM designed to be operated by AI agents, not humans clicking through pages. Same primitives Salesforce and HubSpot have (contacts, deals, tasks, notes, tags), reachable over MCP + CLI + HTTP, with idempotent + dry-runnable + reversible mutations and an append-only audit log.

The user (Augusto García, `augusto@realtialabs.com`) is the founder and only contributor. Read his global instructions in `~/.claude/CLAUDE.md` for language rules, comms preferences, and credentials.

---

## Product context (so you don't ask)

- Public: <https://krabs.dev> · repo: <https://github.com/augusto-devingcc/krabs> · MIT
- Brand: `krabs.dev` is **always lowercase**, even mid-sentence. Voice is terse, direct, technical, dry. No marketing softeners. Prefer code examples over claims.
- Coral `#FF5C2B` is the only chromatic color. Fonts are Geist + Geist Mono. Linear/Vercel-adjacent monochrome, single warm accent.
- Two distribution modes coexist via env-gated features: **hosted SaaS** (krabs.dev/app) and **self-host** (the user runs `pnpm setup`). Don't introduce features that only work in one mode without making the other mode silently no-op.
- v0.5.0 is the current release (as of 2026-05-17). Stripe + Resend integrations are functional and smoke-test-ready. Billing (Polar) is **not wired yet** — the `Pick your plan` screen is a stub.

---

## Architecture at a glance

| Layer | Where | What |
|---|---|---|
| Next.js routes | `app/` | App Router. `(marketing)` + `docs` are static-ish, `(dashboard)` is Clerk-gated, `api/v1/[...path]/route.ts` mounts the Hono API as a catch-all. |
| Hono API | `src/api/` | The actual agent-facing contract. `server.ts` builds the app; `routes/` has per-domain routers; `middleware/auth.ts` resolves bearer tokens; `middleware/error.ts` formats `ApiError` instances. |
| Domain | `src/domain/` | One file per entity: `contact.ts`, `deal.ts`, `task.ts`, `note.ts`, `tag.ts`, `identity.ts`, `interaction.ts`, `account.ts`, `api-key.ts`, `action.ts`, `expense.ts`, `invoice.ts`, `product.ts`, `subscription.ts`, `device-auth.ts`, `import-export.ts`, `clerk-sync.ts`, `counts.ts`, `finance.ts`, `finance-utils.ts`. `shared.ts` has `buildAction()` for the audit row. |
| Database | `src/db/` | `schema.ts` is the Drizzle source of truth. `migrations/` is generated — never hand-edit. `client.ts` opens libSQL. |
| Contract | `src/contract/` | `errors.ts` (`ApiError`, envelope shape), `ids.ts` (`newId('contact')` etc.). |
| Integrations | `src/integrations/` | `stripe/` (Lago-pattern restricted key + auto webhook + event processing) and `resend/` (per-account API key + custom domains + send). Both encrypt secrets via `src/lib/encryption.ts` (AES-256-GCM, key from `KRABS_CRED_ENCRYPTION_KEY`). |
| MCP server | `src/mcp/` | `WebStandardStreamableHTTPServerTransport` mounted at `/v1/mcp`. |
| CLI | `cli/` | Separate package, its own `package.json` + `pnpm-workspace.yaml`. Built with `tsdown`. Distributed via git-clone for v0.4 (Homebrew + npm planned). |
| Tests | `tests/` | Vitest, 106 tests as of last green CI. `phase[1-6].test.ts`, `contacts.test.ts`, `api.test.ts`. |
| Design system | `design-system/` | **Gitignored**. Local working copy of the designer's UI kit (`Krabs.dev Design System/`). Source of truth for visual decisions. Don't ship code that lives in here. |

### Three doors, same primitives

`MCP` (`mcp.krabs.dev`), `CLI` (`krabs`), `HTTP` (`api.krabs.dev`) all funnel through the same Hono app and the same domain functions. Same operation, same response shape, same object graph. If you add a new mutation, expose it on all three.

---

## Frontend — the design system

The dashboard frontend (under `app/(dashboard)/`) was rewritten 2026-05-17 to match the designer's prototype (`design-system/ui_kits/app/index.html`). Style fidelity matters to the user. Follow these rules:

### Hard rules (from the designer's SKILL.md)

- Never use a gradient on text, panels, or backgrounds. Only sanctioned gradient: `--bg` → transparent protection gradient on scrolling lists.
- Never use emoji in product UI. Sanctioned glyphs: `● → ↗ ▾ ✓ ✕ ⌘ ⇧ ⌥`.
- Never use `--radius-full` on buttons. Buttons are slightly-radiused rectangles.
- Never use AI-purple / bluish-violet. Coral `--accent-500` is the only accent.
- Never invent new color tokens. If you need a new value, use `oklch()` against the existing palette and document why.

### Class vocabulary (lives in `app/globals.css`)

All tokens + component styles are in `app/globals.css`. The component styles are split into namespaces:

| Prefix | Surface | Used by |
|---|---|---|
| `.app`, `.main`, `.content` | layout shell | `DashboardChrome.tsx` |
| `.sb-*` | left sidebar | `components/sidebar.tsx` |
| `.tb-*` | top bar | `components/dashboard/Topbar.tsx` |
| `.center`, `.center__head`, `.center__h`, `.center__count` | standard page wrapper | most dashboard pages |
| `.dt__table`, `.dt-name-l`, `.dt-stage`, `.dt-owner`, `.dt-value`, `.dt-updated` | data tables | `components/EntityTable.tsx` `Table` |
| `.rp`, `.rp__head`, `.rp__stats`, `.rp__list`, `.rp__run-*` | runs / activity panel | `/dashboard/audit` |
| `.st`, `.st__rail`, `.st__pane`, `.st-sec`, `.st-row`, `.st-input`, `.st-select`, `.st-toggle` | settings shell | `/dashboard/settings/*` (settings has its own `layout.tsx`) |
| `.cx-*` | contacts-style filter chips + grid | `/dashboard/contacts`, `/dashboard/tasks` for `.cx__chip` |
| `.ag-*` | agent / card-grid pattern, `.ag__summary` for stat bars | `/dashboard`, `/dashboard/finance` |
| `.cp-*` | ⌘K command palette | `components/dashboard/CommandPalette.tsx` |
| `.k-btn`, `.k-badge`, `.k-pip`, `.k-kbd`, `.k-avatar` | primitives | everywhere |
| `.k-eyebrow`, `.k-h2`, `.k-h3`, `.k-h4`, `.k-body`, `.k-body-sm`, `.k-caption`, `.k-mono`, `.k-display` | type utilities | everywhere |

When you add a new page, use these classes directly. **Don't approximate them with shadcn primitives** — the user pushed back on that explicitly. shadcn `Button`/`Input`/`Select` produce visually different output. Use native `<button class="k-btn k-btn--md k-btn--primary">`, native `<label class="st-input"><input/></label>`, native `<select class="st-select">`.

### Sidebar consistency

The main sidebar (`.sb`) **must look identical across all routes**. The user flagged this as a hard requirement. Things that historically broke it:

1. Lazy-loaded Clerk `<UserButton>` inside the sidebar (now removed — keep it out).
2. Wide tables pushing the layout. The shell now has `overflow:hidden` on `.app` and `.main`, and `<Table>` wraps in `overflow-x:auto`. Don't undo these. If you add a new scroll context, audit the chain.
3. The settings rail (`.st__rail`) is a **second** sidebar inside `/dashboard/settings/*`. That's intentional, not a bug.

### Theme

- Provider: `MarketingThemeProvider` (in `components/marketing/theme-context.tsx`), reused by `DashboardChrome.tsx`. Despite the name it's the universal theme provider — rename only if you're going to update all 5 import sites.
- Setting persists in `localStorage` as `krabs-theme`.
- Dark mode applies via both `.dark` class (shadcn convention) and `[data-theme="dark"]` (designer convention). globals.css honors both.
- Sidebar workspace mark swaps SVG per theme (`/brand/logo-mark.svg` vs `/brand/logo-mark-light.svg`) because each SVG has its own bg-rect.

---

## Backend — operating principles

- **Errors**: always throw `ApiError({ code, message, hint? })`. `src/api/middleware/error.ts` wraps it into the standard envelope `{ error: { code, message, hint? }, _schema_version: "1" }`. Don't `c.json({ error: "..." }, 404)` — that drifts the envelope.
- **IDs**: use `newId('contact')`, `newId('deal')`, etc. from `src/contract/ids.ts`. Don't `crypto.randomUUID()` directly — it bypasses the typed prefix.
- **Audit**: every mutation must insert an `agent_actions` row. Use `buildAction()` from `src/domain/shared.ts`. The audit log is the agentic differentiator — losing rows is a regression.
- **Idempotency**: mutations accept `Idempotency-Key` header. Helpers live in `src/contract/`. New mutations should respect it.
- **Reversibility**: destructive ops should return an undo token (24h TTL). See `src/domain/action.ts` `reversibilityOf()`.
- **Webhooks**: Stripe webhook is at `/v1/integrations/stripe/<accountId>/webhook`. All pre-verification failure modes (missing signature header, unknown accountId, inactive integration, bad signature) return the **same** generic `VALIDATION_FAILED: Invalid Stripe webhook signature` response so accountIds aren't enumerable. Don't loosen this without a reason.
- **Encryption**: `src/lib/encryption.ts` is AES-256-GCM keyed by `KRABS_CRED_ENCRYPTION_KEY`. Use it for any per-account third-party secret (Stripe restricted key, Resend API key, webhook secrets).
- **Multi-tenancy**: every domain function takes `ctx: CallerContext = { accountId, apiKeyId }`. Every SQL query must filter by `accountId`. Forgetting this is a cross-tenant leak.

---

## Tooling

```bash
pnpm dev              # Next dev (Turbopack? No — uses --webpack flag)
pnpm dev:api          # Standalone Hono on :3000 (bypasses Next, for backend-only iteration)
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
pnpm test:watch       # vitest watch
pnpm build            # Next build (CI also does this)
pnpm build:cli        # tsdown for cli/dist/index.js
pnpm db:generate      # drizzle-kit generate (after a schema.ts edit)
pnpm db:migrate       # apply pending migrations
pnpm db:seed          # seed dev data
pnpm db:studio        # drizzle studio
pnpm setup            # one-shot local dev bootstrap (creates account + API key)
pnpm lint             # next lint
```

### pnpm gotchas (don't undo these)

- `pnpm-workspace.yaml` at the repo root has `dangerouslyAllowAllBuilds: true`. pnpm 11.x's strict-build mode was breaking CI on every push for builds that needed `esbuild`/`sharp`/`@clerk/shared`/`msw`. The flag is necessary — do not remove.
- `cli/` is its own pnpm context (its `.npmrc` has `ignore-workspace=true`). Same `dangerouslyAllowAllBuilds: true` lives in `cli/pnpm-workspace.yaml`.
- CI (`.github/workflows/ci.yml`) does `mkdir -p ./data` before `pnpm build` because libSQL fails to create the parent dir when `DATABASE_URL=file:./data/ci.db`. Don't remove that line.

### Deploy

- Hosting: **Vercel**. Production domain `krabs.dev` aliases to the latest production deploy automatically on push to `main`.
- Other aliases on the same project: `api.krabs.dev`, `app.krabs.dev`, `mcp.krabs.dev`.
- DNS: Cloudflare. Cloudflare creds live in `~/.claude/credentials/cloudflare.env` (Realtia Labs account, owns `realtialabs.com`, `panamakey.com`, and — since 2026-06-18 — `krabs.dev`). `krabs.dev` was migrated off Vercel's nameservers (`ns1/ns2.vercel-dns.com`) onto Cloudflare (`luke/virginia.ns.cloudflare.com`). Vercel still hosts the deploy; Cloudflare now serves DNS for the zone.

---

## Working with the user

- **Channels**: the user reads **Discord** and **Telegram**, not the terminal. He has feedback-pinned this multiple times. Send all status updates and asks via `mcp__plugin_discord_discord__reply` (chat_id `1488267634767298560`) or `mcp__plugin_telegram_telegram__reply` (chat_id `7704671018`). If Discord errors with "not allowlisted", fall back to Telegram.
- **Language**: Spanish latinoamericano neutro (use `tú`, `puedes`, `quieres`). Never rioplatense (`vos`, `podés`, `tenés`). See his global CLAUDE.md.
- **Decision style**: he picks fast and trusts judgment. Don't ask multiple-choice questions for trivia. For non-trivial scope, present the trade-off in 2-3 sentences and a recommendation.
- **He hates approximations**: "use the designer's elements, not lookalikes" was the literal feedback. When you add UI, match the designer's class vocabulary 1:1 — don't substitute shadcn primitives unless they pixel-match.
- **He pushes back hard on**: tests that mock too much; backwards-compat shims for code nobody will read; comments that paraphrase code; over-engineered abstractions for hypothetical futures. Default to surgical edits.
- **Release rhythm**: he ships v0.x quickly. Major-version bumps are conservative. Cut releases with `gh release create vX.Y.Z` after the corresponding commit lands on `main`, then bump `package.json` `version` and the CLI release notes.

---

## Open scope / known TODOs

- **Plan-gating**: `src/integrations/resend/send.ts:51` has a `TODO: gate by accounts.plan === 'pro'`. It's deferred until Polar (billing) is wired. When Polar lands: add a `plan` column to `accounts`, a `KRABS_REQUIRE_PAID_PLAN` env gate so self-hosters bypass it, and a `requirePaidPlan(ctx)` helper called from `connectStripe` and `sendEmail`.
- **Stripe events not subscribed**: `invoice.created` and `invoice.finalized` aren't in `STRIPE_WEBHOOK_EVENTS`. Add them when the dashboard wants those states.
- **Subscription race**: out-of-order subscription deliveries (`subscription.deleted` before `subscription.created`) aren't handled. Persist by stripe id and reconcile, don't FK to a draft.
- **Resend orphan rows on reconnect**: disconnect+reconnect leaves orphan domain rows. Either soft-delete + revive, or cascade on disconnect.
- **Settings page polish**: the integration sub-pages (`/dashboard/settings/integrations/stripe`, `.../resend`) use the new `.st-sec` pattern but some forms inside still ship shadcn-flavored. Worth a pass.
- **Topbar title**: longest-prefix match resolves `/dashboard/settings/integrations/stripe` to "Settings". Could show "Stripe" instead — the settings layout already shows the page title in `.st__pane-h`, so it's defensible either way.

---

## Don't

- Don't push to `main` without the user's explicit `dale` / `go` / `ok push`. He validates locally first.
- Don't commit `design-system/` — it's gitignored on purpose.
- Don't run `git reset --hard`, `git push --force`, or `--no-verify` unless he explicitly asks.
- Don't introduce a service worker unless asked. The dashboard already has caching headaches.
- Don't `cd` between project dirs without him asking. Stay in `/Users/augustogarcia/Projects/solo-agentic-crm` for this work.
- Don't store secrets in `.env.example`. Real secrets live in `.env.local` (gitignored) and Vercel project env.
- Don't write multi-paragraph docstrings. One line max, only when the WHY is non-obvious.

---

## When in doubt

- Read the designer's prototype: `design-system/ui_kits/app/index.html` (full inline CSS) and `design-system/SKILL.md` (brand rules).
- Read recent commits: `git log --oneline -20` — they capture the user's intent and the trade-offs that were already debated.
- Check `~/.claude/projects/-Users-augustogarcia-Projects-solo-agentic-crm/memory/MEMORY.md` for auto-memory accumulated across sessions.
- Ask via Discord/Telegram before doing anything destructive or scope-expanding.
