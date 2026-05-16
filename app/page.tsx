import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  BookOpen,
  Cable,
  ExternalLink,
  FileCode2,
  GitBranch,
  Globe,
  Lock,
  Network,
  Repeat,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Undo2,
} from "lucide-react";

import { BRAND } from "@/lib/brand.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/components/lib/utils";

/* ─────────────────────────────────────────────────────────────────
 * Landing page — strict monochrome.
 * shadcn/ui primitives + lucide-react icons.
 * Linear.app / Vercel.com style. No accent color. No emoji decoration.
 * Sharp corners. Plenty of whitespace.
 * ───────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#features", label: "features" },
  { href: "#how", label: "how-it-works" },
  { href: "#pricing", label: "pricing" },
  { href: "/v1/schema", label: "docs" },
];

const TRANSPORTS: Array<{
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  blurb: string;
  code: string;
}> = [
  {
    id: "cli",
    title: "CLI",
    icon: Terminal,
    blurb:
      "A single binary, designed to be piped. Every action returns JSON.",
    code: `$ socrm contact.create \\
    --email lisa@acme.com \\
    --name "Lisa Ortega" \\
    --idempotency-key new-lead-2401

{ "id": "ctc_01J6Q…", "version": 1 }`,
  },
  {
    id: "mcp",
    title: "MCP",
    icon: Cable,
    blurb:
      "Drop the server into Claude Desktop, Cursor, or any MCP-aware host.",
    code: `// Claude Desktop / Cursor
{
  "mcpServers": {
    "socrm": {
      "command": "npx",
      "args": ["-y", "@socrm/mcp"],
      "env": { "SOCRM_API_KEY": "sk_…" }
    }
  }
}`,
  },
  {
    id: "http",
    title: "HTTP",
    icon: Globe,
    blurb:
      "REST surface for everything else — automations, scripts, your own UI.",
    code: `POST /v1/contact.create
Authorization: Bearer sk_…
Idempotency-Key: new-lead-2401

{ "email": "lisa@acme.com",
  "name":  "Lisa Ortega" }`,
  },
];

const FEATURES: Array<{
  title: string;
  body: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
}> = [
  {
    title: "Full destructive power, fully audited",
    icon: ShieldCheck,
    body: "Delete, merge, bulk-update — your agent can do all of it. Every mutation lands in an append-only log with the prompt that caused it.",
  },
  {
    title: "Reversible by default",
    icon: Undo2,
    body: "Every destructive operation returns an undo token. One call rewinds it. Agents experiment; mistakes do not become incidents.",
  },
  {
    title: "Multi-channel identity",
    icon: Network,
    body: "One contact, many handles. Email, WhatsApp, Telegram, X, phone, Discord — collapsed into a single record your agent reasons about.",
  },
  {
    title: "Idempotent and dry-run on every mutation",
    icon: Repeat,
    body: "Retries are safe. Plans are previewable. Agents can show you what they're about to do before they do it.",
  },
  {
    title: "Your data is yours",
    icon: Lock,
    body: "account.export returns the full corpus as portable JSON. No lock-in clauses, no support tickets — just one call.",
  },
  {
    title: "46 operations, self-described",
    icon: BookOpen,
    body: "GET /v1/schema returns the entire contract. Your agent reads its own manual and stops asking you what's possible.",
  },
];

const PRICING: Array<{
  name: string;
  price: string;
  cadence: string;
  line: string;
  cta: string;
  href: string;
  featured?: boolean;
}> = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    line: "500 operations / month. Full contract. Personal use.",
    cta: "Start free",
    href: "/sign-up",
  },
  {
    name: "Solo",
    price: "$9",
    cadence: "/ month",
    line: "25k operations. Unlimited contacts. Webhooks and exports.",
    cta: "Start Solo",
    href: "/sign-up",
    featured: true,
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/ month",
    line: "250k operations. SSO, audit retention, priority support.",
    cta: "Start Pro",
    href: "/sign-up",
  },
];

const FOOTER_LINKS: Array<{
  href: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
}> = [
  { href: "/v1/schema", label: "docs" },
  { href: "#", label: "status" },
  { href: "#", label: "changelog" },
  { href: `mailto:${BRAND.email.support}`, label: "contact" },
  { href: "#", label: "x", icon: AtSign },
  { href: "#", label: "github", icon: GitBranch },
];

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <TopNav />

      <Hero />

      <Divider />

      <Problem />

      <Divider />

      <Transports />

      <Divider />

      <Features />

      <Divider />

      <HowItWorks />

      <Divider />

      <PricingTeaser />

      <Divider />

      <FinalCTA />

      <Footer year={year} />
    </main>
  );
}

/* ───────────── nav ───────────── */

function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-mono text-[15px] lowercase tracking-tight text-[var(--color-fg)]"
        >
          {BRAND.name}
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          {NAV_LINKS.map((l) => (
            <Button
              key={l.href}
              asChild
              variant="ghost"
              size="sm"
              className="font-mono lowercase text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">
              Get started
              <ArrowRight size={16} aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ───────────── hero ───────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* faint grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at top, black 30%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 pt-28 pb-32 md:pt-40 md:pb-40">
        <Badge
          variant="outline"
          className="rounded-full bg-[var(--color-surface)] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]"
        >
          <span
            aria-hidden
            className="mr-1 h-1.5 w-1.5 rounded-full bg-[var(--color-fg)]"
          />
          v1 contract — 46 operations
        </Badge>

        <h1 className="mt-8 max-w-3xl text-[44px] md:text-[64px] font-medium leading-[1.04] tracking-tight">
          The default backend for AI agents running businesses.
        </h1>

        <p className="mt-6 max-w-2xl text-[17px] md:text-[19px] leading-relaxed text-[var(--color-fg-muted)]">
          {BRAND.name} is a multi-tenant CRM with one API, three equally
          first-class transports, and an audit log where every mutation is
          reversible. Built for solopreneurs whose agents do the work.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Start free
              <ArrowRight size={16} aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/v1/schema">
              View the contract
              <ExternalLink size={16} aria-hidden />
            </Link>
          </Button>
          <span className="ml-1 font-mono text-[12px] text-[var(--color-fg-faint)]">
            no credit card · 500 ops free / mo
          </span>
        </div>

        <HeroTerminal />
      </div>
    </section>
  );
}

function HeroTerminal() {
  return (
    <Card className="mt-16 gap-0 overflow-hidden rounded-[var(--radius-md)] border-[var(--color-border)] bg-[var(--color-surface)] py-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 [.border-b]:pb-2">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-fg-faint)]">
          <Terminal
            size={14}
            aria-hidden
            className="text-[var(--color-fg-muted)]"
          />
          <span className="ml-1">agent · ~/work</span>
        </div>
        <span className="font-mono text-[11px] text-[var(--color-fg-faint)]">
          zsh
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.65] text-[var(--color-fg-muted)]">
          <span className="text-[var(--color-fg-faint)]">$ </span>
          <span className="text-[var(--color-fg)]">socrm</span> contact.upsert
          --email lisa@acme.com --name &quot;Lisa Ortega&quot;
          {"\n"}
          <span>
            {`{ "id": "ctc_01J6Q…", "version": 1, "created": true }`}
          </span>
          {"\n\n"}
          <span className="text-[var(--color-fg-faint)]">$ </span>
          <span className="text-[var(--color-fg)]">socrm</span> deal.create
          --contact ctc_01J6Q… --amount 12000 --stage qualified --dry-run
          {"\n"}
          <span>
            {`{ "plan": { "would_create": "dl_…", "would_link": "ctc_01J6Q…" } }`}
          </span>
          {"\n\n"}
          <span className="text-[var(--color-fg-faint)]">$ </span>
          <span className="text-[var(--color-fg)]">socrm</span> deal.delete
          dl_2YxR... --reason &quot;dup of dl_2YxK...&quot;
          {"\n"}
          <span>
            {`{ "deleted": "dl_2YxR…", "undo": "undo_8sP3…", "expires_in": 86400 }`}
          </span>
          <span
            aria-hidden
            className="ml-1 inline-block h-[1em] w-[0.5em] -mb-[2px] bg-[var(--color-fg)] animate-pulse"
          />
        </pre>
      </CardContent>
    </Card>
  );
}

/* ───────────── problem ───────────── */

function Problem() {
  return (
    <Section>
      <Eyebrow>The problem</Eyebrow>
      <SectionTitle>
        CRMs were built for humans clicking forms.
        <br />
        Your agents are programmers.
      </SectionTitle>
      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <p className="text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
          Every CRM you have used assumes the operator is a sales rep with a
          mouse. Drag handles. Pipeline cards. Modal after modal. Every action
          designed to be irreversible by the time you have realized you made
          it. Then the agent arrives — and the only path it has is a Chrome
          extension that pretends to be a person.
        </p>
        <p className="text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
          {BRAND.name} starts from the other side. The primary interface is a
          contract. The UI is one of three clients, not the truth. Agents get
          structured input, structured output, an audit log of their own
          decisions, and an undo button for every destructive call.
        </p>
      </div>
    </Section>
  );
}

/* ───────────── transports ───────────── */

function Transports() {
  return (
    <Section id="features">
      <Eyebrow>Three transports, one contract</Eyebrow>
      <SectionTitle>
        Your agent does not learn a special dialect.
      </SectionTitle>
      <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
        Every operation is exposed identically across CLI, MCP, and HTTP. Pick
        the surface your agent already speaks. Switch later without rewriting
        anything.
      </p>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {TRANSPORTS.map((t) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.id}
              className="gap-0 overflow-hidden rounded-[var(--radius-md)] border-[var(--color-border)] bg-[var(--color-surface)] py-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-border)] px-4 py-3 [.border-b]:pb-3">
                <div className="flex items-center gap-2">
                  <Icon
                    size={16}
                    aria-hidden
                    className="text-[var(--color-fg-muted)]"
                  />
                  <CardTitle className="font-mono text-[12px] uppercase tracking-wider text-[var(--color-fg-muted)]">
                    {t.title}
                  </CardTitle>
                </div>
                <span className="font-mono text-[11px] text-[var(--color-fg-faint)]">
                  {t.id}
                </span>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-0">
                <p className="px-5 pt-5 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
                  {t.blurb}
                </p>
                <pre className="mx-5 my-5 flex-1 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 font-mono text-[12px] leading-relaxed text-[var(--color-fg)]">
                  {t.code}
                </pre>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

/* ───────────── features ───────────── */

function Features() {
  return (
    <Section>
      <Eyebrow>Why solopreneurs choose {BRAND.name}</Eyebrow>
      <SectionTitle>
        A CRM that disappears so your agents can run.
      </SectionTitle>
      <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
        The boring infrastructure that lets one founder, plus a constellation
        of agents, operate at the scale of a 20-person team.
      </p>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <Card
              key={i}
              className="gap-3 rounded-[var(--radius-md)] border-[var(--color-border)] bg-[var(--color-surface)] py-7 shadow-none"
            >
              <CardHeader className="gap-3 px-7">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--color-fg)]">
                    <Icon size={20} aria-hidden />
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <CardTitle className="text-[17px] font-medium leading-snug text-[var(--color-fg)]">
                  {f.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-7">
                <CardDescription className="text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
                  {f.body}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

/* ───────────── how it works ───────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Sign up",
      body: "30-second account creation. You get one workspace, one API key, and a 500-op free tier with the full contract unlocked.",
    },
    {
      n: "02",
      title: "Get an API key",
      body: "From the dashboard, or from the CLI with socrm auth login. Scoped, rotatable, revocable.",
    },
    {
      n: "03",
      title: "Drop it into your agent",
      body: "Claude Desktop, Cursor, your own scripts, n8n, a cron job. Anything that speaks JSON-RPC, MCP, or HTTP.",
    },
    {
      n: "04",
      title: "Your agent has full CRM access",
      body: "It can read every contact, write every deal, and undo every mistake — all while you watch the log in real time.",
    },
  ];

  const configJson = `{
  "mcpServers": {
    "socrm": {
      "command": "npx",
      "args": ["-y", "@socrm/mcp"],
      "env": {
        "SOCRM_API_KEY": "sk_live_..."
      }
    }
  }
}`;

  return (
    <Section id="how">
      <Eyebrow>How it works</Eyebrow>
      <SectionTitle>Four steps. Roughly four minutes.</SectionTitle>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.n} className="flex items-stretch gap-3">
              <Card className="flex-1 gap-3 rounded-[var(--radius-md)] border-[var(--color-border)] bg-[var(--color-surface)] py-6 shadow-none">
                <CardHeader className="flex flex-row items-start gap-4 px-6">
                  <Badge
                    variant="outline"
                    className="h-7 min-w-9 rounded-md border-[var(--color-border-strong)] bg-transparent font-mono text-[12px] text-[var(--color-fg)]"
                  >
                    {s.n}
                  </Badge>
                  <div className="flex flex-col gap-1.5">
                    <CardTitle className="text-[15px] font-medium text-[var(--color-fg)]">
                      {s.title}
                    </CardTitle>
                    <CardDescription className="text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
                      {s.body}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
              {i < steps.length - 1 ? (
                <div
                  aria-hidden
                  className="hidden lg:flex items-center pr-1 text-[var(--color-fg-faint)]"
                >
                  <ArrowRight size={16} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <Card className="gap-0 rounded-[var(--radius-md)] border-[var(--color-border)] bg-[var(--color-surface)] py-0 shadow-none">
          <CardHeader className="flex flex-row items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5 [.border-b]:pb-2.5">
            <FileCode2
              size={14}
              aria-hidden
              className="text-[var(--color-fg-muted)]"
            />
            <CardTitle className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-faint)] normal-case truncate">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-[var(--color-fg)]">
              {configJson}
            </pre>
            <div className="border-t border-[var(--color-border)] px-5 py-3 font-mono text-[11px] text-[var(--color-fg-faint)]">
              Restart Claude Desktop. The agent now has 46 typed tools.
            </div>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

/* ───────────── pricing teaser ───────────── */

function PricingTeaser() {
  return (
    <Section id="pricing">
      <Eyebrow>Pricing</Eyebrow>
      <SectionTitle>Priced for one operator, not one seat.</SectionTitle>
      <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
        No per-seat tax. No quote calls. The free tier is enough to run a side
        project; the paid tiers are enough to run a real one.
      </p>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {PRICING.map((p) => (
          <Card
            key={p.name}
            className={cn(
              "gap-0 rounded-[var(--radius-md)] border bg-[var(--color-surface)] py-7 shadow-none",
              p.featured
                ? "border-[var(--color-border-strong)]"
                : "border-[var(--color-border)]"
            )}
          >
            <CardHeader className="gap-6 px-7">
              <div className="flex items-center justify-between">
                <CardTitle className="font-mono text-[13px] uppercase tracking-wider text-[var(--color-fg-muted)]">
                  {p.name}
                </CardTitle>
                {p.featured ? (
                  <Badge
                    variant="outline"
                    className="rounded-[var(--radius-sm)] border-[var(--color-border)] font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)]"
                  >
                    Popular
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] font-medium tracking-tight text-[var(--color-fg)]">
                  {p.price}
                </span>
                <span className="font-mono text-[12px] text-[var(--color-fg-faint)]">
                  {p.cadence}
                </span>
              </div>
            </CardHeader>
            <CardContent className="mt-4 flex flex-1 flex-col px-7">
              <CardDescription className="text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
                {p.line}
              </CardDescription>
              <Button
                asChild
                variant={p.featured ? "default" : "outline"}
                className="mt-7 w-full"
              >
                <Link href={p.href}>
                  {p.cta}
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <Button
          asChild
          variant="link"
          className="px-0 font-mono text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          <Link href="/sign-up">
            see full pricing
            <ArrowRight size={14} aria-hidden />
          </Link>
        </Button>
      </div>
    </Section>
  );
}

/* ───────────── final cta ───────────── */

function FinalCTA() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-5xl px-6 py-28 md:py-40">
        <Card className="gap-0 rounded-[var(--radius-md)] border-[var(--color-border)] bg-[var(--color-surface)] p-10 py-0 shadow-none md:p-16">
          <CardHeader className="px-0">
            <Badge
              variant="outline"
              className="mb-6 rounded-full border-[var(--color-border)] bg-transparent px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]"
            >
              <Sparkles size={12} aria-hidden className="mr-1" />
              Ready when your agent is
            </Badge>
            <CardTitle className="max-w-3xl text-[32px] md:text-[44px] font-medium leading-[1.1] tracking-tight">
              Stop building CRM-shaped adapters for your agents.
              <br />
              <span className="text-[var(--color-fg-muted)]">
                Use the one that&apos;s already shaped for them.
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-10 flex flex-wrap items-center gap-3 px-0">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Start free
                <Rocket size={16} aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/v1/schema">
                Read the contract
                <ExternalLink size={16} aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/* ───────────── footer ───────────── */

function Footer({ year }: { year: number }) {
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[14px] lowercase text-[var(--color-fg)]">
            {BRAND.name}
          </span>
          <span className="font-mono text-[12px] text-[var(--color-fg-faint)]">
            © {year} {BRAND.domain}
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-[var(--color-fg-muted)]">
          {FOOTER_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.label}
                href={l.href}
                className="inline-flex items-center gap-1.5 lowercase hover:text-[var(--color-fg)] transition-colors"
              >
                {Icon ? <Icon size={14} aria-hidden /> : null}
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}

/* ───────────── reusable bits ───────────── */

function Divider() {
  return <div className="border-t border-[var(--color-border)]" aria-hidden />;
}

function Section({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 max-w-3xl text-[30px] md:text-[44px] font-medium leading-[1.1] tracking-tight text-[var(--color-fg)]">
      {children}
    </h2>
  );
}

