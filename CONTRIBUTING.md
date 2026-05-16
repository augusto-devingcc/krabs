# Contributing to krabs

Thanks for opening this file. krabs is early — small, sharp PRs are the ones that land.

## Setup

```bash
git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
pnpm install
cp .env.example .env.local   # fill in Clerk + Turso credentials
pnpm db:migrate
pnpm dev
```

Node 22+ and pnpm 11+ are required.

## The contract

krabs makes five guarantees on every operation (intent, idempotency, dry-run, schema introspection, reversible audit — see [README](./README.md#the-contract)). Every change to the public API must keep those intact.

- Add new endpoints. Do not break old ones.
- New mutations accept `Idempotency-Key` and `--dry-run` from day one.
- Destructive operations return an `undo_token` valid for 24 hours.
- `/v1/schema` must continue to describe the full surface — no hidden endpoints.

If a change needs to break the contract, open an issue first and tag it `contract-break`.

## Voice

Follow the voice rules in [`public/skill.md`](./public/skill.md). The short version:

- Terse, direct, technical. Examples over claims.
- Lowercase product name: "krabs" / "krabs.dev". Never "Krabs" or "KRABS".
- Sentence case for headings, buttons, menus.
- No marketing softeners: avoid *seamless, powerful, magical, supercharge, leverage, robust, intuitive*.
- No emoji in code, copy, or commits. Sanctioned glyphs: `● → ↗ ▾ ✓ ✕`.
- Quote IDs verbatim in mono: `ctc_01J6Q…`, not "the contact for Lisa".

This applies to UI copy, docs, error messages, commit subjects, and PR descriptions.

## Tests

```bash
pnpm test          # vitest, single run
pnpm test:watch    # vitest, watch mode
pnpm typecheck     # tsc --noEmit
```

Test priority, in order:

1. **Domain tests.** Pure functions in `src/domain/`. Cheapest, fastest, most valuable. Every new domain function gets one.
2. **Integration tests.** Hono routes against an in-memory libSQL. Cover the happy path and the failure modes the contract promises.
3. **E2E tests.** Last resort. Only when the seam being tested cannot be covered above.

A PR that adds a domain function without a test will be asked for one.

## Branches & PRs

- Branch from `main`. Name it `feat/<thing>`, `fix/<thing>`, or `docs/<thing>`.
- Small PRs preferred. One concern per PR.
- Squash on merge. The PR title becomes the commit subject — write it like a release note.
- Link the issue it closes in the PR body (`closes #123`).
- CI must be green. `pnpm typecheck`, `pnpm test`, `pnpm lint` all pass.

## Style

- Prettier handles formatting. Do not hand-format.
- Do not ship comments that say what the code does. Add comments only for *why*, and only when non-obvious.
- Prefer `fetch` over axios, native `node:` modules over polyfills, and Drizzle helpers over raw SQL.
- TypeScript strict mode stays on. No `any` without a comment explaining the unavoidable boundary.

## What we don't accept

- Emoji in code, copy, commits, or PR descriptions.
- Marketing softeners in user-facing text.
- New dependencies that duplicate something we already pull in. Check `package.json` first.
- Generated boilerplate left in place (commented imports, scaffolded files, unused exports).
- PRs that touch unrelated formatting alongside the actual change.

## Reporting bugs

[Open an issue](https://github.com/augusto-devingcc/krabs/issues/new/choose). Include the operation, the request, the response, and the version of `krabs` you're on (`krabs --version`).

For security issues, see [SECURITY.md](./SECURITY.md). Do not open a public issue.
