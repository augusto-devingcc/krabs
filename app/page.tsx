import Link from "next/link";
import { BRAND } from "@/lib/brand.js";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-[var(--color-accent)] text-lg lowercase">
          {BRAND.name}
        </span>
        <nav className="flex items-center gap-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="#features" className="hover:text-[var(--color-fg)]">
            features
          </Link>
          <Link href="#pricing" className="hover:text-[var(--color-fg)]">
            pricing
          </Link>
          <Link
            href="/v1/schema"
            className="hover:text-[var(--color-fg)] font-mono"
          >
            /v1/schema
          </Link>
          <Link
            href="/sign-in"
            className="text-[var(--color-fg)] hover:text-[var(--color-accent)]"
          >
            sign in →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center max-w-3xl mx-auto">
        <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-6">
          # CRM for the agentic era
        </p>
        <h1 className="text-5xl md:text-6xl font-medium tracking-tight mb-6 leading-[1.05]">
          A CRM your agents can{" "}
          <span className="text-[var(--color-accent)]">fully drive.</span>
        </h1>
        <p className="text-lg text-[var(--color-fg-muted)] max-w-xl mb-10">
          Same API for CLI, MCP, and HTTP. Every mutation is audited, every
          destructive op is reversible, and your data is yours — exportable as
          JSON anytime.
        </p>
        <div className="flex gap-3">
          <Link
            href="/sign-up"
            className="bg-[var(--color-accent)] text-[var(--color-bg)] px-5 py-2.5 rounded-[var(--radius)] font-medium hover:bg-[var(--color-accent-hover)]"
          >
            Start free
          </Link>
          <Link
            href="#features"
            className="border border-[var(--color-border-strong)] px-5 py-2.5 rounded-[var(--radius)] hover:border-[var(--color-fg-muted)]"
          >
            See the contract
          </Link>
        </div>

        {/* Terminal hint */}
        <pre className="mt-16 text-left text-sm font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 max-w-2xl w-full overflow-x-auto">
          <span className="text-[var(--color-fg-faint)]">$ </span>
          <span className="text-[var(--color-accent)]">curl</span>{" "}
          {`https://${BRAND.domain}/v1/schema`}
          {"\n"}
          <span className="text-[var(--color-fg-muted)]">
            {`{ "operations": [ /* 46 documented operations */ ], "schemaVersion": "1" }`}
          </span>
        </pre>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] px-6 py-6 text-sm text-[var(--color-fg-muted)] flex flex-col md:flex-row justify-between gap-3">
        <span className="font-mono">{BRAND.name}.dev</span>
        <span>built for solopreneurs who let their agents drive</span>
      </footer>
    </main>
  );
}
