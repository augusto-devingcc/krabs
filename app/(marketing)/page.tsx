"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BRAND } from "@/lib/brand.js";

/* Landing — krabs.dev marketing surface.
   Structure lifted from designer's ui_kits/marketing/index.html.
   Styling lives in globals.css under `.mk-*` classes. Nav + Footer
   are provided by the route-group layout. */

const TABS: Record<
  "mcp" | "cli" | "http",
  { label: string; caption: string; code: string }
> = {
  mcp: {
    label: "Mount via MCP",
    caption: "Two lines in your agent's MCP config.",
    code: `{
  "mcpServers": {
    "krabs": {
      "command": "npx",
      "args": ["-y", "@krabs/mcp"],
      "env": { "KRABS_API_KEY": "$KRABS_TOKEN" }
    }
  }
}`,
  },
  cli: {
    label: "Call via CLI",
    caption: "Every endpoint is a tool. Every tool returns JSON.",
    code: `$ krabs contact.upsert --email lisa@acme.com --name "Lisa Ortega"
{ "id": "ctc_01J6Q…", "version": 1, "created": true }

$ krabs deal.create --contact ctc_01J6Q… --amount 12000 --stage qualified --dry-run
{ "plan": { "would_create": "dl_…", "would_link": "ctc_01J6Q…" } }

$ krabs deal.delete dl_2YxR... --reason "dup of dl_2YxK..."
{ "deleted": "dl_2YxR…", "undo": "undo_8sP3…", "expires_in": 86400 }`,
  },
  http: {
    label: "Use the HTTP API",
    caption: "REST surface — automations, scripts, your own UI.",
    code: `POST https://api.krabs.dev/v1/contact.create
Authorization: Bearer $KRABS_TOKEN
Idempotency-Key: new-lead-2401
Content-Type: application/json

{ "email": "lisa@acme.com", "name": "Lisa Ortega" }

→ 200 { "id": "ctc_01J6Q…", "version": 1, "created": true }`,
  },
};

const FEATURES: Array<{ eyebrow: string; title: string; body: string }> = [
  {
    eyebrow: "audit",
    title: "Full destructive power, fully audited.",
    body: "Delete, merge, bulk-update — your agent can do all of it. Every mutation lands in an append-only log with the prompt that caused it.",
  },
  {
    eyebrow: "undo",
    title: "Reversible by default.",
    body: "Every destructive operation returns an undo token. One call rewinds it. Agents experiment; mistakes do not become incidents.",
  },
  {
    eyebrow: "identity",
    title: "Multi-channel identity.",
    body: "One contact, many handles. Email, WhatsApp, Telegram, X, phone, Discord — collapsed into a single record your agent reasons about.",
  },
  {
    eyebrow: "safety",
    title: "Idempotent and dry-run on every mutation.",
    body: "Retries are safe. Plans are previewable. Agents can show you what they're about to do before they do it.",
  },
  {
    eyebrow: "portability",
    title: "Your data is yours.",
    body: "account.export returns the full corpus as portable JSON. No lock-in clauses, no support tickets — just one call.",
  },
  {
    eyebrow: "contract",
    title: "46 operations, self-described.",
    body: "GET /v1/schema returns the entire contract. Your agent reads its own manual and stops asking you what's possible.",
  },
];

export default function Home() {
  return (
    <>
      <Hero />
      <CodeShowcase />
      <FeatureGrid />
      <ClosingCTA />
    </>
  );
}

function Hero() {
  return (
    <section className="mk-hero">
      <div className="mk-hero__bg" aria-hidden />
      <div className="mk-hero__inner">
        <Link href="#features" className="mk-hero__eyebrow">
          <span className="mk-hero__eyebrow-pip">●</span>
          v1 contract — 46 operations, three transports
          <span style={{ opacity: 0.55, marginLeft: 4 }}>→</span>
        </Link>
        <h1 className="mk-hero__h1">
          The default backend for
          <br />
          AI agents running businesses.
        </h1>
        <p className="mk-hero__sub">
          {BRAND.productName} is a multi-tenant CRM with one API, three equally
          first-class transports, and an audit log where every mutation is
          reversible. Built for solopreneurs whose agents do the work.
        </p>
        <div className="mk-hero__ctas">
          <Link href="/sign-up" className="mk-btn mk-btn--primary mk-btn--lg">
            Start free
          </Link>
          <Link href="/v1/schema" className="mk-btn mk-btn--secondary mk-btn--lg">
            View the contract <span style={{ marginLeft: 4 }}>→</span>
          </Link>
        </div>
        <div className="mk-hero__terminal">
          <div className="mk-term__head">
            <span className="mk-term__dot" />
            <span className="mk-term__dot" />
            <span className="mk-term__dot" />
            <span className="mk-term__title">~/agents/sales · zsh</span>
          </div>
          <pre className="mk-term__body">
            <span className="mk-c-dim">$</span>
            {" krabs contact.upsert "}
            <span className="mk-c-acc">--email</span>
            {" "}
            <span className="mk-c-str">lisa@acme.com</span>
            {" "}
            <span className="mk-c-acc">--name</span>
            {" "}
            <span className="mk-c-str">&quot;Lisa Ortega&quot;</span>
            {"\n"}
            <span className="mk-c-dim">→</span>
            {" "}
            <span className="mk-c-str">{`{ "id": "ctc_01J6Q…", "version": 1, "created": true }`}</span>
            {"\n\n"}
            <span className="mk-c-dim">$</span>
            {" krabs deal.create "}
            <span className="mk-c-acc">--contact</span>
            {" ctc_01J6Q… "}
            <span className="mk-c-acc">--amount</span>
            {" 12000 "}
            <span className="mk-c-acc">--stage</span>
            {" qualified "}
            <span className="mk-c-acc">--dry-run</span>
            {"\n"}
            <span className="mk-c-dim">→</span>
            {" plan ready · would_create "}
            <span className="mk-c-acc">dl_…</span>
            {"\n\n"}
            <span className="mk-c-dim">$</span>
            {" krabs deal.delete "}
            <span className="mk-c-acc">dl_2YxR…</span>
            {"\n"}
            <span className="mk-c-dim">→</span>
            {" deleted · undo "}
            <span className="mk-c-acc">undo_8sP3…</span>
            {" · 24h"}
          </pre>
        </div>
      </div>
    </section>
  );
}

function CodeShowcase() {
  const [tab, setTab] = useState<keyof typeof TABS>("mcp");
  const active = TABS[tab];

  return (
    <section className="mk-cs">
      <div className="mk-cs__inner">
        <div className="mk-cs__lead">
          <div className="mk-eyebrow">interfaces</div>
          <h2 className="mk-h2">Three doors. Same primitives.</h2>
          <p className="mk-sub">
            Agents speak MCP. Humans speak CLI. Apps speak HTTP. {BRAND.name}{" "}
            answers in all three with the exact same object graph behind it.
          </p>
        </div>

        <div className="mk-cs__pane">
          <div className="mk-cs__tabs">
            {(Object.keys(TABS) as Array<keyof typeof TABS>).map((k) => (
              <button
                key={k}
                className={`mk-cs__tab${tab === k ? " on" : ""}`}
                onClick={() => setTab(k)}
                type="button"
              >
                {TABS[k].label}
              </button>
            ))}
          </div>
          <div className="mk-cs__caption">{active.caption}</div>
          <pre className="mk-cs__code">{active.code}</pre>
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="mk-fg" id="features">
      <div className="mk-fg__inner">
        <div className="mk-fg__lead">
          <div className="mk-eyebrow">why {BRAND.name}</div>
          <h2 className="mk-h2">A CRM that disappears so your agents can run.</h2>
        </div>
        <div className="mk-fg__grid">
          {FEATURES.map((f) => (
            <div className="mk-fg__cell" key={f.eyebrow}>
              <div className="mk-fg__cell-eyebrow">{f.eyebrow}</div>
              <h3 className="mk-fg__cell-title">{f.title}</h3>
              <p className="mk-fg__cell-body">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCTA() {
  const [copied, setCopied] = useState(false);
  const command = "git clone github.com/augusto-devingcc/krabs && cd krabs && pnpm setup";

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // ignore copy errors
    }
  };

  return (
    <section className="mk-cta" id="install">
      <div className="mk-cta__inner">
        <div className="mk-eyebrow">install</div>
        <h2 className="mk-cta__h">Start in 5 minutes.</h2>
        <p className="mk-cta__p">
          No demo call. No 14-day trial. Clone the repo, run setup, you have an
          API + CLI on localhost. Hosted free tier with 500 ops/month at sign-up.
        </p>
        <div className="mk-cta__install">
          <span className="pmt">$</span>
          <span>{command}</span>
          <button className="copy" onClick={onCopy} type="button">
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
    </section>
  );
}
