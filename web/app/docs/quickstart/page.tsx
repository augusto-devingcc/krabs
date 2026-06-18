import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "install", label: "Install" },
  { id: "mint-a-key", label: "Mint a key" },
  { id: "wire-claude-desktop", label: "Wire Claude Desktop" },
  { id: "your-first-call", label: "Your first call" },
  { id: "next-steps", label: "Next steps" },
];

export default function QuickstartPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / quickstart</div>
          <h1 className="dc__h1">Quickstart</h1>
          <p className="dc__lede">
            Sign up, mint a key, wire {BRAND.name} into your agent of choice, run your first call.
            About five minutes.
          </p>

          <h2 className="dc__h2" id="install">
            Install
          </h2>
          <p>
            krabs ships from source today. Homebrew + npm distribution are wired but unpublished
            (see <Link href="/docs/install#homebrew-npm">install · Homebrew · npm</Link>). Clone
            and build:
          </p>
          <pre className="dc__code">{`git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
pnpm install
pnpm setup`}</pre>
          <p>
            <code>pnpm setup</code> mints an API key against a local SQLite DB and saves it to{" "}
            <code>~/.config/krabs/config.json</code>. Your CLI is now authenticated against your
            local API at <code>http://localhost:3000</code>.
          </p>
          <p>
            See the <Link href="/docs/install">install guide</Link> for symlinking the CLI to your{" "}
            <code>PATH</code>, uninstall, and the distribution roadmap.
          </p>

          <Callout tone="info" title="free and open source">
            {BRAND.name} is MIT-licensed and self-hosted. There are no plans, quotas, or metering —
            you run it on your own box.
          </Callout>

          <h2 className="dc__h2" id="mint-a-key">
            Mint a key
          </h2>
          <p>
            <code>pnpm setup</code> mints your first bootstrap key automatically. For anything else
            — an agent, a script, a deployed worker — create a scoped key from the CLI with{" "}
            <code>krabs key create</code>.
          </p>
          <p>
            Tokens look like this:
          </p>
          <pre className="dc__code">{`krabs_sk_4n7q2vh3jpz9w8x1y0c5b6d4f8g2k1m3`}</pre>
          <p>
            The full token is shown <strong>once</strong> at creation. We store only a hash. If you
            lose it, rotate.
          </p>

          <h2 className="dc__h2" id="wire-claude-desktop">
            Wire Claude Desktop
          </h2>
          <p>
            Open <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> and
            add the {BRAND.name} server under <code>mcpServers</code>.
          </p>
          <pre className="dc__code">{`{
  "mcpServers": {
    "krabs": {
      "transport": "https",
      "url": "https://${BRAND.mcp}",
      "auth": {
        "type": "bearer",
        "token": "krabs_sk_…"
      }
    }
  }
}`}</pre>
          <p>
            Restart Claude Desktop. The {BRAND.name} tools appear in the tool drawer; the agent can
            now reach every operation listed in the contract.
          </p>

          <h2 className="dc__h2" id="your-first-call">
            Your first call
          </h2>
          <p>
            Three transports, one operation. Each of the following creates the same invoice.
          </p>
          <p>
            <strong>MCP</strong> — ask the agent in natural language; the host invokes the tool:
          </p>
          <pre className="dc__code">{`tool: invoice.create
args: {
  "counterparty": "Acme Inc",
  "amount": 120000,
  "currency": "USD"
}`}</pre>
          <p>
            <strong>CLI</strong>:
          </p>
          <pre className="dc__code">{`krabs invoice create \\
  --counterparty "Acme Inc" \\
  --amount 120000 \\
  --currency USD`}</pre>
          <p>
            <strong>HTTP</strong>:
          </p>
          <pre className="dc__code">{`curl https://${BRAND.api}/v1/invoice.create \\
  -H "Authorization: Bearer $KRABS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "counterparty": "Acme Inc",
    "amount": 120000,
    "currency": "USD"
  }'`}</pre>
          <p>
            All three return the same JSON: an <code>invoice</code> object with a stable id.
          </p>

          <h2 className="dc__h2" id="next-steps">
            Next steps
          </h2>
          <ul>
            <li>
              <Link href="/docs/auth">Auth & tokens →</Link> scopes, rotation, and how revocation
              behaves under load.
            </li>
            <li>
              <Link href="/docs/contract">The contract →</Link> the five properties every
              operation honors.
            </li>
            <li>
              <Link href="/docs/finance">Finance reporting →</Link> summary, MRR, expenses by
              category, and the funnel.
            </li>
          </ul>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/quickstart/page.tsx"
              target="_blank"
              rel="noopener noreferrer"
            >
              Edit this page on GitHub →
            </a>
            <span style={{ color: "var(--fg-3)" }}>last updated 2026-05-17 · v0.5.0</span>
          </div>
        </article>
      </main>
      <DocsToc items={TOC} />
    </>
  );
}
