import Link from "next/link";
import { Clock, History, Search, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/docs/page-header";
import { CodeBlock, InlineCode } from "@/components/docs/code-block";
import { Note } from "@/components/docs/note";

export default function AuditLogPage() {
  return (
    <article className="space-y-10">
      <PageHeader
        eyebrow="Concepts"
        title="Audit log"
        description="Every write socrm executes — whether issued by a human, an API key, or an MCP-attached agent — lands in agent_actions. The log is queryable, exportable, and partially reversible."
      />

      <section className="space-y-4 text-muted-foreground">
        <p>
          The audit log is the source of truth for &quot;what did the agent
          do.&quot; It is also the substrate for undo, dispute resolution, and
          incident review. Nothing useful happens in socrm without a row in{" "}
          <InlineCode>agent_actions</InlineCode>.
        </p>
        <p>
          Read access is on the same key that issued the write. List with{" "}
          <InlineCode>action.list</InlineCode>, fetch one with{" "}
          <InlineCode>action.get</InlineCode>, and reverse one with{" "}
          <InlineCode>action.undo</InlineCode>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <History size={20} aria-hidden /> What gets captured
        </h2>
        <p className="text-muted-foreground">
          Each action row holds the operation, the target entity, the actor,
          the intent, a before/after diff, and metadata to reconstruct context.
          Concretely:
        </p>
        <CodeBlock language="json">
{`{
  "id": "act_01HZX3Y...",
  "operation": "contact.update",
  "target": { "kind": "contact", "id": "ctc_01H..." },
  "actor": {
    "kind": "api_key",
    "id": "key_01H...",
    "name": "claude-desktop"
  },
  "intent": "user asked to update phone number",
  "idempotencyKey": "2026-05-15-ada-phone",
  "before": { "phone": "+1 555 0100" },
  "after":  { "phone": "+1 555 0199" },
  "reversible": true,
  "metadata": {
    "transport": "mcp",
    "clientVersion": "0.4.1",
    "requestId": "req_01H..."
  },
  "createdAt": "2026-05-15T13:42:11Z"
}`}
        </CodeBlock>
        <p className="text-muted-foreground">
          The <InlineCode>before</InlineCode> / <InlineCode>after</InlineCode>{" "}
          fields are the minimal patch needed to reverse the change — not the
          full row. This keeps the log small and makes diffs trivial to render.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Search size={20} aria-hidden /> Querying the log
        </h2>
        <p className="text-muted-foreground">
          <InlineCode>action.list</InlineCode> supports filters by actor,
          target kind, operation, time range, and reversibility. The output is
          cursor-paginated.
        </p>
        <CodeBlock language="bash">
{`curl https://socrm.dev/v1/action.list \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -d '{
    "actor": { "kind": "api_key", "id": "key_01H..." },
    "operation": "contact.delete",
    "since": "2026-05-14T00:00:00Z",
    "reversibleOnly": true,
    "limit": 50
  }'`}
        </CodeBlock>
        <Note variant="info" title="Retention">
          Action rows are retained for 18 months on the default plan. Use{" "}
          <InlineCode>account.export</InlineCode> to keep a longer archive.
        </Note>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Undo2 size={20} aria-hidden /> Undo semantics
        </h2>
        <p className="text-muted-foreground">
          Undo is a first-class operation. It is also boring on purpose: it
          replays the inverse of the diff stored on the action row. If the
          inverse is no longer applicable — for example because the target was
          deleted by a later action — the server returns a structured error
          rather than guessing.
        </p>
        <CodeBlock language="bash">
{`curl https://socrm.dev/v1/action.undo \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -d '{
    "actionId": "act_01HZX3Y...",
    "intent": "rollback bad batch import"
  }'`}
        </CodeBlock>
        <h3 className="mt-6 text-base font-medium tracking-tight">
          One-way operations
        </h3>
        <p className="text-muted-foreground">
          A handful of operations are intentionally one-way: hard deletes
          executed without a soft-delete first, irreversible CSV imports
          flagged as <InlineCode>append-only</InlineCode>, and any operation
          that publishes outside socrm (for example an email send). These rows
          carry <InlineCode>reversible: false</InlineCode> and the undo call
          fails fast.
        </p>
        <h3 className="mt-6 text-base font-medium tracking-tight">
          Undo is idempotent
        </h3>
        <p className="text-muted-foreground">
          Calling <InlineCode>action.undo</InlineCode> twice on the same action
          ID yields the same final state. The first call inserts a new audit
          row pointing back at the original; the second call detects the prior
          undo and returns success without writing anything.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Clock size={20} aria-hidden /> Putting it together
        </h2>
        <p className="text-muted-foreground">
          The combination of an introspectable schema, dry-run, idempotency
          keys, and a reversible audit log is what makes socrm agent-safe.
          Wired together, your agent can plan, preview, commit, and rewind
          without leaving the API. For end-to-end examples, see{" "}
          <Link href="/docs/recipes" className="underline text-foreground">
            Recipes
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
