---
name: krabs
description: Operate krabs.dev — a CRM designed to be used by AI agents. Manages contacts, identities, deals, interactions, tasks, notes, and tags. Reachable over MCP (mcp.krabs.dev), CLI (krabs), or HTTP (api.krabs.dev). Every mutation is idempotent, dry-runnable, and reversible via an undo token. Use this skill when the operator needs to read or write CRM state.
license: MIT
---

# krabs.dev — agent skill

You are operating **krabs.dev**, a multi-tenant CRM designed to be invoked by AI agents (not humans clicking through pages). Every primitive — contact, identity, interaction, deal, task, note, tag — is reachable as a tool. Every mutation is idempotent, dry-runnable, and reversible.

This skill teaches you the contract, the voice, and the common operations. For the live, machine-readable schema of all 46 operations, fetch `https://api.krabs.dev/v1/schema`.

## How to call krabs

There are three transports. They are equivalent — the same operation, the same response shape.

### MCP (preferred when the host supports it)

The host mounts krabs as a tool server. You receive tools like `krabs.contact.upsert`, `krabs.deal.create`, etc. Call them directly. Configuration lives in the host:

```json
{
  "mcpServers": {
    "krabs": {
      "url": "https://mcp.krabs.dev",
      "auth": { "type": "bearer", "token": "$KRABS_TOKEN" }
    }
  }
}
```

### CLI (when you have a shell)

```bash
krabs contact.upsert --email lisa@acme.com --name "Lisa Ortega"
krabs deal.create --contact ctc_01J6Q… --amount 12000 --stage qualified
krabs runs tail --agent agent_drafts
```

Every command accepts `--json` (default) and `--dry-run`.

### HTTP (when nothing else fits)

```http
POST https://api.krabs.dev/v1/contact.upsert
Authorization: Bearer $KRABS_TOKEN
Idempotency-Key: <stable-key>
Content-Type: application/json

{ "email": "lisa@acme.com", "name": "Lisa Ortega" }
```

## Authentication

All calls carry a bearer token in the `Authorization` header (or `auth.token` in MCP config, or `$KRABS_TOKEN` env for CLI). Tokens look like `krabs_sk_<32-chars>`. They are shown once at creation and never again — store them in the agent's secrets, not in code.

If you don't have a token, the human runs the device flow on their machine:

```bash
# v0.4: from source
git clone https://github.com/augusto-devingcc/krabs.git
cd krabs && pnpm install && pnpm setup
# pnpm setup writes a local-mode token. For the hosted krabs.dev:
./cli/dist/index.js auth login --api-url https://api.krabs.dev
```

The login command opens a browser, the user approves, and the token lands at `~/.config/krabs/config.json`. Or, in any host runtime, ask the user to visit `https://krabs.dev/device` and enter the device code you generated via `POST https://api.krabs.dev/v1/auth/device`. See [auth docs](https://krabs.dev/docs/auth).

## Primitives

| primitive | what it is | id prefix |
|---|---|---|
| contact | a person | `ctc_` |
| identity | one handle on a contact (email, phone, telegram, …) | `idn_` |
| interaction | any inbound/outbound message | `int_` |
| deal | work in motion with stage and amount | `dl_` |
| task | a unit of work assignable to an agent or human | `tsk_` |
| note | free-form context attached to any record | `nt_` |
| tag | a label you assign and filter by | `tg_` |

## Common operations

### Create or update a contact (idempotent)

```bash
krabs contact.upsert \
  --email lisa@acme.com \
  --name "Lisa Ortega" \
  --idempotency-key "outreach-lisa-2026-05"
```

Returns `{ "id": "ctc_01J6Q…", "version": N, "created": true|false }`. Re-running with the same idempotency key returns the same record without writing.

### Link a second identity to the contact

```bash
krabs identity.attach --contact ctc_01J6Q… --channel telegram --handle "@lisaortega"
```

### Create a deal

```bash
krabs deal.create \
  --contact ctc_01J6Q… \
  --name "Acme · Q3 renewal" \
  --amount 12000 \
  --stage qualified
```

### Preview before writing (dry-run)

Every mutation accepts `--dry-run`. krabs returns a plan with what it would write, but writes nothing:

```bash
krabs deal.delete dl_2YxR… --dry-run
# → { "plan": { "would_delete": "dl_2YxR…", "cascade": ["nt_…"] } }
```

### Undo a destructive operation

Destructive writes return an `undo_token` valid for 24 hours:

```bash
krabs deal.delete dl_2YxR…
# → { "deleted": "dl_2YxR…", "undo": "undo_8sP3…", "expires_in": 86400 }

krabs undo undo_8sP3…
# → { "restored": "dl_2YxR…" }
```

### Tail the audit log

Every call (yours and other agents') is persisted. To watch in real time:

```bash
krabs runs tail --agent agent_drafts
# 14:08:22  threads.append   18ms  ok
# 14:04:11  deals.evaluate   24ms  ok
```

Or stream via SSE: `GET /v1/runs/{run_id}/stream`.

## Errors and recovery

All errors are structured. You receive an object with `code`, `message`, optional `hint`.

| code | meaning | recovery |
|---|---|---|
| `auth_missing` | no token in request | mint a token via device flow |
| `auth_invalid` | token doesn't parse | check format `krabs_sk_…` |
| `auth_expired` | token rotated or expired | run `krabs login` |
| `auth_revoked` | token soft-deleted | mint a new one |
| `rate_limited` | too many calls (default 60/agent/min) | retry with backoff, header `Retry-After` gives seconds |
| `not_found` | record doesn't exist or you can't see it | check the id |
| `conflict` | concurrent write to same record | refetch, retry |
| `validation` | argument failed schema | read `details.field` for which one |

Retry `rate_limited` and `conflict` automatically with exponential backoff. Do not retry `auth_*` or `validation` — fix the input first.

## Voice when talking back to the user

If you write user-facing copy (notes, replies, summaries), follow krabs voice:

- **Terse, direct, technical.** "Deal created · `dl_01HG…`" — not "I've successfully created the deal for you!"
- **Lowercase product name.** Write "krabs" and "krabs.dev", never "Krabs" or "KRABS".
- **No marketing softeners.** Avoid: *seamless, powerful, magical, supercharge, leverage, robust, intuitive*.
- **Examples over claims.** Paste the code block. Show the response.
- **Precise numbers.** "P50 18ms · 24 of 25 calls ok" — not "fast and reliable".
- **Sentence case for everything.** "Create deal", not "Create Deal".
- **No emoji.** Sanctioned glyphs: `● → ↗ ▾ ✓ ✕`.
- **Quote IDs verbatim in mono.** `ctc_01J6Q…`, not "the contact for Lisa".

## When to use which transport

- **MCP** — your host speaks MCP and the tools you need are exposed. Most efficient. No extra round-trip.
- **CLI** — you have a shell, you're piping output, or you're being demonstrated to a human. Best for live demos.
- **HTTP** — your runtime isn't MCP-capable and you can't shell out. Last resort but always available.

If unsure: prefer MCP > CLI > HTTP.

## What to do when stuck

1. Re-read this skill.
2. Fetch `https://api.krabs.dev/v1/schema` — the live, machine-readable contract is the source of truth.
3. Read `https://krabs.dev/docs/contract` for the five guarantees krabs makes.
4. If a `validation` error: read `details.field` and the schema entry for that operation.
5. Email `support@krabs.dev` if you genuinely cannot proceed.

## Further reading

- [Quickstart](https://krabs.dev/docs/quickstart)
- [Auth & tokens](https://krabs.dev/docs/auth)
- [The contract](https://krabs.dev/docs/contract)
- [Runs & SSE](https://krabs.dev/docs/runs)
- [Webhooks](https://krabs.dev/docs/webhooks)

---

skill version `v0.4.3` · last updated `2026-05-16` · source `https://krabs.dev/skill.md`
