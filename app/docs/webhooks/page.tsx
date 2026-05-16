import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "subscribing", label: "Subscribing" },
  { id: "event-types", label: "Event types" },
  { id: "payload-shape", label: "Payload shape" },
  { id: "signing-and-verification", label: "Signing & verification" },
  { id: "retries", label: "Retries" },
  { id: "replay", label: "Replay" },
];

export default function WebhooksPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / webhooks</div>
          <h1 className="dc__h1">Webhooks</h1>
          <p className="dc__lede">
            {BRAND.name} delivers signed, retried, at-least-once webhooks for every event your
            agents care about.
          </p>

          <h2 className="dc__h2" id="subscribing">
            Subscribing
          </h2>
          <p>
            From the dashboard, or CLI:
          </p>
          <pre className="dc__code">{`krabs webhooks create \\
  --url https://yourapp.com/krabs \\
  --events "deal.*,contact.upsert"`}</pre>
          <p>
            Output:
          </p>
          <pre className="dc__code">{`webhook_id: whk_01HGZ9X4QY8M2N7P3R5T6V8W
url:        https://yourapp.com/krabs
events:     deal.*, contact.upsert
secret:     whsec_2v8x4n6q1jpz9w8x1y0c5b6d4f8g
            ↑ copy now, you will not see this again`}</pre>
          <p>
            The signing secret is shown once. {BRAND.name} stores only a hash and uses the
            plaintext to sign outgoing payloads.
          </p>

          <h2 className="dc__h2" id="event-types">
            Event types
          </h2>
          <p>
            Patterns support <code>*</code> as a single-segment wildcard. <code>deal.*</code>{" "}
            matches <code>deal.created</code> and <code>deal.stage_changed</code> but not{" "}
            <code>deal.line.added</code>; use <code>deal.**</code> for the latter.
          </p>
          <table className="dc__table">
            <thead>
              <tr>
                <th>event</th>
                <th>fires when</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>contact.created</code></td>
                <td>a new contact row is written</td>
              </tr>
              <tr>
                <td><code>contact.updated</code></td>
                <td>any field on a contact changes</td>
              </tr>
              <tr>
                <td><code>deal.created</code></td>
                <td>a new deal is opened</td>
              </tr>
              <tr>
                <td><code>deal.stage_changed</code></td>
                <td>a deal moves between pipeline stages</td>
              </tr>
              <tr>
                <td><code>task.completed</code></td>
                <td>a task transitions to <code>done</code></td>
              </tr>
              <tr>
                <td><code>interaction.received</code></td>
                <td>an inbound message lands on any channel</td>
              </tr>
            </tbody>
          </table>

          <h2 className="dc__h2" id="payload-shape">
            Payload shape
          </h2>
          <p>
            Every delivery is one JSON object. The <code>data</code> field carries the full record
            after the change; the <code>actor</code> field names the agent or human that caused it.
          </p>
          <pre className="dc__code">{`{
  "id": "evt_01HG7Z4X9Q8M2N7P3R5T6V8W",
  "type": "deal.stage_changed",
  "created_at": "2026-05-16T14:22:08Z",
  "data": {
    "id": "dl_01HG…",
    "name": "Acme Q3 expansion",
    "stage": "negotiation",
    "previous_stage": "proposal",
    "amount": 48000,
    "currency": "USD"
  },
  "actor": {
    "kind": "agent",
    "id": "agent_drafts",
    "label": "drafts"
  },
  "run_id": "run_01HG7Z4X9Q8M2N7P3R5T6V8W"
}`}</pre>

          <h2 className="dc__h2" id="signing-and-verification">
            Signing & verification
          </h2>
          <p>
            {BRAND.name} signs every payload with HMAC-SHA256 using the webhook&rsquo;s secret. The
            signature lands in <code>X-Krabs-Signature</code> as{" "}
            <code>t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>. Verify in Node.js:
          </p>
          <pre className="dc__code">{`import crypto from "node:crypto";

export function verify(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = parts.t;
  const sig = parts.v1;
  if (!t || !sig) return false;

  const signed = \`\${t}.\${rawBody}\`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signed)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}`}</pre>
          <p>
            Reject the request if the signature does not verify or the timestamp is more than five
            minutes off wall-clock.
          </p>

          <h2 className="dc__h2" id="retries">
            Retries
          </h2>
          <p>
            Failed deliveries retry with exponential backoff: <code>+30s</code>, <code>+5m</code>,{" "}
            <code>+25m</code>. Three attempts total, capped at thirty minutes. After the third
            failure the delivery is marked <code>failed</code> and surfaced in the dashboard.
          </p>

          <Callout tone="warning" title="respond within 10s">
            Webhook endpoints must respond with a 2xx status within 10 seconds or {BRAND.name}{" "}
            counts the delivery as a failure and schedules a retry. Acknowledge first, process
            asynchronously.
          </Callout>

          <h2 className="dc__h2" id="replay">
            Replay
          </h2>
          <p>
            Every delivery is logged. Replay any delivery — failed or successful — from the
            dashboard or CLI:
          </p>
          <pre className="dc__code">{`krabs webhooks replay dlv_01HG7Z4X9Q8M2N7P3R5T6V8W`}</pre>
          <p>
            Replay sends the original payload with the original signature, plus a new{" "}
            <code>X-Krabs-Delivery-Id</code> header so your handler can dedupe. Replayed events do
            not count against retry budgets.
          </p>
          <p>
            <Link href="/docs/runs">Runs & SSE →</Link>{" "}
            <Link href="/docs/contract">The contract →</Link>
          </p>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/webhooks/page.tsx"
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
