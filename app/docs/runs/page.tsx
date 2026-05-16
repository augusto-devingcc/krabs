import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "what-is-a-run", label: "What is a run" },
  { id: "creating-a-run", label: "Creating a run" },
  { id: "attaching-calls", label: "Attaching calls" },
  { id: "streaming-via-sse", label: "Streaming via SSE" },
  { id: "tail", label: "Tail" },
  { id: "audit-as-replay", label: "Audit as replay" },
];

export default function RunsPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / runs</div>
          <h1 className="dc__h1">Runs & SSE</h1>
          <p className="dc__lede">
            An agent run is one logical session of tool calls against {BRAND.name}. Every call is
            persisted, signed, and streamable.
          </p>

          <h2 className="dc__h2" id="what-is-a-run">
            What is a run
          </h2>
          <p>
            A run is a sequence of tool calls sharing the same <code>run_id</code>. Runs scope
            audit, billing, replay, and live streaming. Two callers operating concurrently produce
            two independent runs even if they touch the same records.
          </p>
          <p>
            A run is created implicitly when an agent connects to <code>{BRAND.mcp}</code> — the
            MCP session id becomes the run id. For CLI- or HTTP-driven workflows, runs are created
            explicitly.
          </p>

          <h2 className="dc__h2" id="creating-a-run">
            Creating a run
          </h2>
          <pre className="dc__code">{`krabs runs create --agent agent_drafts --name "Q3 outreach pass"`}</pre>
          <p>
            Output:
          </p>
          <pre className="dc__code">{`run_id:    run_01HG7Z4X9Q8M2N7P3R5T6V8W
agent:     agent_drafts
name:      Q3 outreach pass
created:   2026-05-16T14:22:08Z
status:    open`}</pre>
          <p>
            The run stays open until you close it, or it ages out after 24 hours of inactivity.
          </p>

          <h2 className="dc__h2" id="attaching-calls">
            Attaching calls
          </h2>
          <p>
            Pass the run id as a header or environment variable. Every call that carries it is
            attached to that run.
          </p>
          <pre className="dc__code">{`# HTTP
curl https://${BRAND.api}/v1/contact.upsert \\
  -H "Authorization: Bearer $KRABS_API_KEY" \\
  -H "X-Krabs-Run: run_01HG7Z4X9Q8M2N7P3R5T6V8W" \\
  -H "Content-Type: application/json" \\
  -d '{ … }'

# CLI
export KRABS_RUN_ID=run_01HG7Z4X9Q8M2N7P3R5T6V8W
krabs contact upsert --email ada@lovelace.dev`}</pre>
          <p>
            Calls without a run id land on an ad-hoc run named <code>default</code> that resets
            daily.
          </p>

          <h2 className="dc__h2" id="streaming-via-sse">
            Streaming via SSE
          </h2>
          <p>
            Subscribe to a run with <code>GET /v1/runs/&#123;run_id&#125;/stream</code>. The
            response is Server-Sent Events: one <code>event: tool_call</code> message per call as
            it lands.
          </p>
          <pre className="dc__code">{`curl -N https://${BRAND.api}/v1/runs/run_01HG7Z4X9Q8M2N7P3R5T6V8W/stream \\
  -H "Authorization: Bearer $KRABS_API_KEY" \\
  -H "Accept: text/event-stream"`}</pre>
          <p>
            Sample frame:
          </p>
          <pre className="dc__code">{`event: tool_call
data: {
  "ts": "2026-05-16T14:22:31.418Z",
  "op": "contact.upsert",
  "args": { "identity": { "kind": "email", "value": "ada@lovelace.dev" } },
  "result": { "id": "ct_01HG…", "created": true },
  "latency_ms": 42
}`}</pre>

          <Callout tone="info" title="prefer SSE">
            SSE is preferred over polling. {BRAND.name} sends a <code>: keepalive</code> comment
            every 15 seconds; if your client receives no data for 30 seconds, the connection is
            stale and should reconnect with the last seen <code>id</code> field.
          </Callout>

          <h2 className="dc__h2" id="tail">
            Tail
          </h2>
          <p>
            <code>krabs runs tail</code> polls the dashboard firehose and formats the stream for
            terminals.
          </p>
          <pre className="dc__code">{`krabs runs tail --agent agent_drafts`}</pre>
          <p>
            Output:
          </p>
          <pre className="dc__code">{`14:22:31.418  contact.upsert       42ms   ✓
14:22:31.690  identity.attach      18ms   ✓
14:22:32.103  interaction.record   61ms   ✓
14:22:32.890  deal.create          77ms   ✓
14:22:33.504  task.assign          22ms   ✕  invalid_assignee`}</pre>
          <p>
            <code>--follow</code> stays attached; <code>--since 5m</code> backfills the last five
            minutes before live-tailing.
          </p>

          <h2 className="dc__h2" id="audit-as-replay">
            Audit as replay
          </h2>
          <p>
            Every run is an append-only log of typed tool calls and results. That log is
            replayable: feed it through <code>krabs runs replay</code> with{" "}
            <code>--dry-run</code> and {BRAND.name} re-executes each call against current state,
            reporting what <em>would</em> happen if executed today.
          </p>
          <pre className="dc__code">{`krabs runs replay run_01HG7Z4X9Q8M2N7P3R5T6V8W --dry-run`}</pre>
          <p>
            Useful for: debugging an outreach pass that misbehaved, regression-testing an agent
            after a prompt change, simulating a backfill before running it. No writes happen until
            you drop <code>--dry-run</code>.
          </p>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/runs/page.tsx"
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
