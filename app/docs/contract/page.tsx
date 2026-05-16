import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "the-five-properties", label: "The five properties" },
  { id: "the-46-operations", label: "The 46 operations" },
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
            Forty-six operations, one machine-readable schema, three transports that honor it
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
              <strong>Intent</strong> — every endpoint is a verb-noun, e.g. <code>contact.upsert</code>.
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
              destructive ones (<code>contact.delete</code>, <code>deal.delete</code>, etc.) return
              an <code>undo_token</code> valid for 24 hours. One call rolls the row back.
            </li>
          </ul>

          <h2 className="dc__h2" id="the-46-operations">
            The 46 operations
          </h2>
          <p>
            Seven primitive nouns plus <code>agent</code> and <code>account</code>, totaling
            forty-six verbs.
          </p>
          <table className="dc__table">
            <thead>
              <tr>
                <th>namespace</th>
                <th>count</th>
                <th>examples</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>contact</code></td>
                <td>8</td>
                <td><code>contact.upsert</code>, <code>contact.get</code>, <code>contact.search</code>, <code>contact.merge</code></td>
              </tr>
              <tr>
                <td><code>identity</code></td>
                <td>5</td>
                <td><code>identity.attach</code>, <code>identity.detach</code>, <code>identity.lookup</code></td>
              </tr>
              <tr>
                <td><code>interaction</code></td>
                <td>6</td>
                <td><code>interaction.record</code>, <code>interaction.thread</code>, <code>interaction.search</code></td>
              </tr>
              <tr>
                <td><code>deal</code></td>
                <td>7</td>
                <td><code>deal.create</code>, <code>deal.advance</code>, <code>deal.close</code>, <code>deal.forecast</code></td>
              </tr>
              <tr>
                <td><code>task</code></td>
                <td>6</td>
                <td><code>task.create</code>, <code>task.assign</code>, <code>task.complete</code></td>
              </tr>
              <tr>
                <td><code>note</code></td>
                <td>5</td>
                <td><code>note.append</code>, <code>note.list</code>, <code>note.pin</code></td>
              </tr>
              <tr>
                <td><code>tag</code></td>
                <td>4</td>
                <td><code>tag.apply</code>, <code>tag.remove</code>, <code>tag.list</code></td>
              </tr>
              <tr>
                <td><code>agent</code></td>
                <td>3</td>
                <td><code>agent.register</code>, <code>agent.list</code>, <code>agent.revoke</code></td>
              </tr>
              <tr>
                <td><code>account</code></td>
                <td>2</td>
                <td><code>account.usage</code>, <code>account.audit</code></td>
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
          <pre className="dc__code">{`"account.audit"
"account.usage"
"agent.list"
"agent.register"
"agent.revoke"
"contact.delete"
"contact.get"
"contact.list"
"contact.merge"
"contact.search"
"contact.tag"
"contact.untag"
"contact.upsert"
"deal.advance"
"deal.close"
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
            <Link href="/docs/runs">Runs & SSE →</Link>{" "}
            <Link href="/docs/webhooks">Webhooks →</Link>
          </p>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/contract/page.tsx"
              target="_blank"
              rel="noopener noreferrer"
            >
              Edit this page on GitHub →
            </a>
            <span style={{ color: "var(--fg-3)" }}>last updated 2026-05-16 · v0.4.3</span>
          </div>
        </article>
      </main>
      <DocsToc items={TOC} />
    </>
  );
}
