import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChefHat,
  FileCode2,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/docs/page-header";
import { Card } from "@/components/ui/card";
import { InlineCode } from "@/components/docs/code-block";

const cards = [
  {
    href: "/docs/getting-started",
    title: "Getting started",
    description:
      "Sign up, mint an API key, wire socrm into Claude Desktop, and run your first agent command in under five minutes.",
    icon: Sparkles,
  },
  {
    href: "/docs/concepts/agent-contract",
    title: "Agent contract",
    description:
      "The five primitives every operation honors: intent, idempotency, dry-run, schema introspection, and a reversible audit log.",
    icon: FileCode2,
  },
  {
    href: "/docs/api-reference",
    title: "API reference",
    description:
      "All 46 operations, grouped by entity, with destructive and reversible flags, idempotency support, and example payloads.",
    icon: BookOpen,
  },
  {
    href: "/docs/recipes",
    title: "Recipes",
    description:
      "Copy-paste runbooks for the things agents actually do: ingest email, dedupe contacts, undo a bad import, audit a fleet.",
    icon: ChefHat,
  },
];

export default function DocsIndexPage() {
  return (
    <article>
      <PageHeader
        eyebrow="Documentation"
        title="The CRM for agents"
        description="socrm is a contact, deal, and activity database designed to be operated by autonomous agents. Same API surface over HTTP, CLI, and MCP. Every write is logged. Most writes are reversible."
      />

      <section className="prose-docs space-y-5 text-[15px] leading-7 text-muted-foreground">
        <p>
          Most CRMs were built for humans clicking buttons. socrm assumes the
          caller is a long-running agent that needs to introspect the schema,
          dry-run a change, commit it with an{" "}
          <InlineCode>idempotency-key</InlineCode>, and undo it if something
          downstream caught fire. The product is the contract.
        </p>
        <p>
          These docs cover the public read endpoints, the agent-facing write
          endpoints, the audit log, and the patterns we recommend for building
          on top. If you are new, start with{" "}
          <Link href="/docs/getting-started" className="underline text-foreground">
            Getting started
          </Link>
          . If you want to understand the design, read{" "}
          <Link
            href="/docs/concepts/agent-contract"
            className="underline text-foreground"
          >
            Agent contract
          </Link>
          .
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.href}
              className="group relative flex flex-col gap-3 p-6 transition-colors hover:bg-accent/40"
            >
              <Icon size={20} aria-hidden className="text-foreground" />
              <h3 className="text-base font-medium tracking-tight">
                <Link
                  href={card.href}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  {card.title}
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5">
                Read <ArrowRight size={14} aria-hidden />
              </span>
            </Card>
          );
        })}
      </section>

      <section className="mt-12 space-y-4 border-t border-border pt-8">
        <h2 className="text-xl font-medium tracking-tight">Where to next</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <Link href="/docs/concepts/audit-log" className="underline text-foreground">
              Audit log
            </Link>{" "}
            — what every mutation records, and how undo works.
          </li>
          <li>
            <Link
              href="/docs/concepts/multi-channel-identity"
              className="underline text-foreground"
            >
              Multi-channel identity
            </Link>{" "}
            — one contact, many handles. The identity index makes lookups O(1).
          </li>
          <li>
            <Link href="/docs/recipes" className="underline text-foreground">
              Recipes
            </Link>{" "}
            — short, end-to-end examples agents use in production.
          </li>
        </ul>
      </section>
    </article>
  );
}
