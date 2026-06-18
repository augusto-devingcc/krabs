import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "the-five-properties", label: "The five properties" },
  { id: "the-operations", label: "The 52 operations" },
  { id: "reading-the-schema", label: "Reading the schema" },
  { id: "versioning", label: "Versioning" },
  { id: "compliance-tests", label: "Compliance tests" },
];

export default function ContractPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / contract</div>
          <h1 className="dc__h1">The contract</h1>
          <p className="dc__lede">
            Fifty-two operations, one machine-readable schema, three transports that honor it
            identically. {BRAND.name} is the contract.
          </p>

          <h2 className="dc__h2" id="the-five-properties">
            The five properties
          </h2>
          <p>
            Every operation in {BRAND.name} honors the same five properties. The transports differ
            in wire format; the guarantees do not.
          </p>
          <ul>
            <li>
              <strong>Intent</strong> — every endpoint is a verb-noun, e.g. <code>invoice.create</code>.
              CRUD verbs from HTTP never leak into the model. The agent picks an operation by name,
              not by method.
            </li>
            <li>
              <strong>Idempotency</strong> — every mutation accepts an <code>Idempotency-Key</code>.
              Replaying the same key returns the same result without a second write. Retries are
              safe by default.
            </li>
            <li>
              <strong>Dry-run</strong> — every mutation accepts <code>--dry-run</code> on the CLI
              or <code>dry_run: true</code> on MCP and HTTP. The response describes the plan: the
              records that would be touched, the diff that would be written, the audit row that
              would land. Nothing is persisted.
            </li>
            <li>
              <strong>Schema introspection</strong> — <code>GET /v1/schema</code> returns the full
              contract: every operation, every argument, every error code. The agent reads its own
              manual. No SDK is required.
            </li>
            <li>
              <strong>Reversible audit</strong> — every write lands in an append-only log. The
              reversible ones (<code>account.update</code>, <code>api_key.create</code>,{" "}
              <code>api_key.revoke</code>) return an <code>undo_token</code>. One call rolls the row
              back. Finance writes are recorded but treated as one-way.
            </li>
          </ul>

          <h2 className="dc__h2" id="the-operations">
            The operations
          </h2>
          <p>
            Four finance primitives (<code>product</code>, <code>subscription</code>,{" "}
            <code>invoice</code>, <code>expense</code>) plus the meta surfaces (<code>account</code>,{" "}
            <code>api_key</code>, <code>action</code>, <code>finance</code> reporting). The exact
            list, with input schemas, is always at{" "}
            <Link href="/v1/schema"><code>/v1/schema</code></Link>.
          </p>
          <table className="dc__table">
            <thead>
              <tr>
                <th>namespace</th>
                <th>count</th>
                <th>verbs</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>product</code></td>
                <td>4</td>
                <td><code>create · get · list · update</code></td>
              </tr>
              <tr>
                <td><code>subscription</code></td>
                <td>7</td>
                <td><code>create · get · list · update · pause · resume · cancel</code></td>
              </tr>
              <tr>
                <td><code>invoice</code></td>
                <td>7</td>
                <td><code>create · get · list · update · send · pay · void</code></td>
              </tr>
              <tr>
                <td><code>expense</code></td>
                <td>5</td>
                <td><code>create · get · list · update · delete</code></td>
              </tr>
              <tr>
                <td><code>account</code></td>
                <td>1</td>
                <td><code>update</code></td>
              </tr>
              <tr>
                <td><code>api_key</code></td>
                <td>3</td>
                <td><code>create · list · revoke</code></td>
              </tr>
              <tr>
                <td><code>action</code></td>
                <td>3</td>
                <td><code>get · list · undo</code></td>
              </tr>
              <tr>
                <td><code>finance</code></td>
                <td>4</td>
                <td><code>summary · mrr · expenses_by_category · funnel</code></td>
              </tr>
            </tbody>
          </table>

          <h2 className="dc__h2" id="reading-the-schema">
            Reading the schema
          </h2>
          <p>
            The schema is one JSON document. Agents read it on connect; humans curl it.
          </p>
          <pre className="dc__code">{`curl https://$KRABS_TOKEN@${BRAND.api}/v1/schema | jq '.operations | keys[]'`}</pre>
          <p>
            Truncated output:
          </p>
          <pre className="dc__code">{`"account.export"
"account.update"
"action.get"
"action.list"
"action.undo"
"api_key.create"
"api_key.list"
"api_key.revoke"
"expense.create"
"expense.delete"
"expense.get"
"expense.list"
"expense.update"
"finance.summary"
"invoice.create"
"invoice.pay"
"invoice.send"
"invoice.void"
"product.create"
"subscription.create"
…`}</pre>
          <p>
            Each entry resolves to a typed argument schema, a typed return schema, the full set of
            error codes it can raise, and links to the relevant audit events.
          </p>

          <h2 className="dc__h2" id="versioning">
            Versioning
          </h2>
          <p>
            v1 is stable. Breaking changes ship under v2 with a six-month overlap window during
            which both versions remain reachable on the same domains. Additive changes — new
            operations, new optional fields, new error codes — ship in v1.x without notice.
          </p>
          <p>
            The schema document carries a <code>version</code> field and a per-operation{" "}
            <code>added_in</code> marker. Agents written against v1.0 keep working against v1.7.
          </p>

          <h2 className="dc__h2" id="compliance-tests">
            Compliance tests
          </h2>
          <p>
            Every transport publishes a compliance test suite as part of its release. The suite
            exercises all five properties against a live endpoint and asserts conformance.
          </p>
          <p>
            Anyone can plug their own agent host into the suite and verify it speaks the contract
            faithfully. The same suite runs in {BRAND.name}&rsquo;s own CI on every commit. A
            transport that fails compliance does not ship.
          </p>
          <p>
            <Link href="/v1/schema"><code>/v1/schema</code></Link> →{" "}
            <Link href="/docs/finance">Finance reporting →</Link>
          </p>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/contract/page.tsx"
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
