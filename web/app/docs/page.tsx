import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";

const TOC = [
  { id: "what-is-krabs", label: "What is krabs" },
  { id: "three-doors", label: "Three doors" },
  { id: "primitives", label: "Primitives" },
  { id: "next-steps", label: "Next steps" },
];

export default function DocsIndex() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / introduction</div>
          <h1 className="dc__h1">Introduction</h1>
          <p className="dc__lede">
            krabs.dev is a personal finance tracker designed to be operated by AI agents.
            Income, expenses, cashflow — products, subscriptions, invoices, expenses — reachable
            as tools instead of pages. Self-hosted, open source, no login.
          </p>

          <h2 className="dc__h2" id="what-is-krabs">
            What is krabs
          </h2>
          <p>
            Existing finance tools assume the operator is a human clicking through forms. krabs assumes
            the operator is a model. Every record is reachable over three interfaces with the
            exact same object graph behind them. Every mutation is idempotent, dry-runnable,
            and reversible.
          </p>
          <p>
            One founder, plus a fleet of agents, can operate at the scale of a 20-person team —
            so long as the substrate they share is one designed for them.
          </p>

          <h2 className="dc__h2" id="three-doors">
            Three doors
          </h2>
          <p>
            The same operation can be invoked over three transports. Pick the one your agent
            already speaks.
          </p>

          <table className="dc__table">
            <thead>
              <tr>
                <th>transport</th>
                <th>endpoint</th>
                <th>for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>MCP</code>
                </td>
                <td>
                  <code>mcp.krabs.dev</code>
                </td>
                <td>agentic hosts — Claude Desktop, Cursor, Claude Code</td>
              </tr>
              <tr>
                <td>
                  <code>CLI</code>
                </td>
                <td>
                  <code>krabs</code>
                </td>
                <td>shell-driven agents, humans, scripts</td>
              </tr>
              <tr>
                <td>
                  <code>HTTP</code>
                </td>
                <td>
                  <code>api.krabs.dev</code>
                </td>
                <td>everything else — n8n, cron, your own UI</td>
              </tr>
            </tbody>
          </table>

          <h2 className="dc__h2" id="primitives">
            Primitives
          </h2>
          <p>
            Four finance primitives plus finance reporting. The full set of operations is described at{" "}
            <Link href="/v1/schema">
              <code>/v1/schema</code>
            </Link>
            .
          </p>
          <ul>
            <li>
              <code>product</code> — something you sell, with a name and price.
            </li>
            <li>
              <code>subscription</code> — recurring revenue, optionally tied to a counterparty.
            </li>
            <li>
              <code>invoice</code> — a one-off charge, with status (draft, sent, paid, void).
            </li>
            <li>
              <code>expense</code> — money out, with an amount and category.
            </li>
            <li>
              <code>finance</code> — reporting: summary, MRR, expenses by category, funnel.
            </li>
          </ul>

          <Callout tone="info" title="audit by default">
            Every mutation lands in an append-only log. The agent that ran it, the prompt that
            triggered it, the diff it left — all queryable. Account and key operations are
            reversible via an undo token.
          </Callout>

          <h2 className="dc__h2" id="next-steps">
            Next steps
          </h2>
          <ul>
            <li>
              <Link href="/docs/quickstart">Quickstart →</Link> get a key, wire krabs into Claude
              Desktop, run your first command in five minutes.
            </li>
            <li>
              <Link href="/docs/auth">Auth & tokens →</Link> how to mint, scope, and rotate keys.
            </li>
            <li>
              <Link href="/docs/contract">The contract →</Link> what the operation spec
              guarantees.
            </li>
          </ul>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/page.tsx"
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
