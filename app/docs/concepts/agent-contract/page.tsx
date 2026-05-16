import Link from "next/link";
import {
  FileCode2,
  Fingerprint,
  History,
  ScanSearch,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/docs/page-header";
import { CodeBlock, InlineCode } from "@/components/docs/code-block";
import { Note } from "@/components/docs/note";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AgentContractPage() {
  return (
    <article className="space-y-10">
      <PageHeader
        eyebrow="Concepts"
        title="Agent contract"
        description="Five safety primitives every socrm operation honors. Agents that respect them get a predictable, recoverable, debuggable system."
      />

      <section className="space-y-3 text-muted-foreground">
        <p>
          A traditional REST API expects the caller to know what it is doing.
          That assumption breaks when the caller is a model with a 200k context
          window and a probability distribution over next tokens. socrm shifts
          the burden: the API explains itself, refuses to commit without
          consent, and remembers what it did so you can roll it back.
        </p>
        <p>
          The five primitives below are not optional. Every write goes through
          all of them.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <FileCode2 size={20} aria-hidden /> Intent
        </h2>
        <p className="text-muted-foreground">
          Every write requires an <InlineCode>intent</InlineCode> string — one
          line of natural language describing why the operation is happening.
          Intents are stored on the audit record and surfaced in the dashboard.
          They are the difference between &quot;contact X was deleted&quot; and{" "}
          &quot;contact X was deleted because the dedupe job merged them into
          contact Y.&quot;
        </p>
        <Tabs defaultValue="http">
          <TabsList>
            <TabsTrigger value="http">HTTP</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>
          <TabsContent value="http">
            <CodeBlock language="bash">
{`curl https://socrm.dev/v1/contact.delete \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -d '{
    "id": "ctc_01H...",
    "intent": "duplicate of ctc_02K..., merged earlier"
  }'`}
            </CodeBlock>
          </TabsContent>
          <TabsContent value="mcp">
            <CodeBlock language="json">
{`{
  "tool": "contact_delete",
  "args": {
    "id": "ctc_01H...",
    "intent": "duplicate of ctc_02K..., merged earlier"
  }
}`}
            </CodeBlock>
          </TabsContent>
        </Tabs>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Fingerprint size={20} aria-hidden /> Idempotency
        </h2>
        <p className="text-muted-foreground">
          Network retries and model-retry loops are normal. Pass an{" "}
          <InlineCode>idempotency-key</InlineCode> on any create-like operation
          and socrm returns the same result for the same key for 24 hours. The
          second call does not double-write. Keys are scoped per account and
          per operation.
        </p>
        <Tabs defaultValue="http">
          <TabsList>
            <TabsTrigger value="http">HTTP</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>
          <TabsContent value="http">
            <CodeBlock language="bash">
{`curl https://socrm.dev/v1/contact.create \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -H "Idempotency-Key: 2026-05-15-ada-import" \\
  -d '{ "name": "Ada Lovelace", "intent": "csv row 42" }'`}
            </CodeBlock>
          </TabsContent>
          <TabsContent value="mcp">
            <CodeBlock language="json">
{`{
  "tool": "contact_create",
  "args": {
    "name": "Ada Lovelace",
    "intent": "csv row 42",
    "idempotencyKey": "2026-05-15-ada-import"
  }
}`}
            </CodeBlock>
          </TabsContent>
        </Tabs>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <ShieldCheck size={20} aria-hidden /> Dry run
        </h2>
        <p className="text-muted-foreground">
          Every write supports <InlineCode>dryRun: true</InlineCode>. The server
          validates the payload, resolves references, computes what would
          change, and returns the same response shape as a real call — minus
          the side effect. Bulk operations show you exactly how many rows would
          be touched. Use dry-run before any batch job, and let the agent show
          its work to the human in the loop.
        </p>
        <CodeBlock language="bash">
{`curl https://socrm.dev/v1/contact.import_csv \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -F "file=@leads.csv" \\
  -F "dryRun=true"
# => { "wouldCreate": 142, "wouldUpdate": 7, "wouldSkip": 3, "errors": [] }`}
        </CodeBlock>
        <Note variant="tip">
          A dry-run plan can be replayed by passing its <InlineCode>planId</InlineCode>{" "}
          back to the real call. The server guarantees the plan still applies
          or rejects the call with a stale-plan error.
        </Note>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <ScanSearch size={20} aria-hidden /> Schema introspection
        </h2>
        <p className="text-muted-foreground">
          Agents should not have to be trained on your API. Call{" "}
          <InlineCode>schema.describe</InlineCode> and you get back the full
          machine-readable contract: every operation, its JSON schema, the
          flags (destructive, reversible, idempotent, supports dry-run), and a
          short human description. Cache it, diff it on deploys, generate
          tooling from it.
        </p>
        <Tabs defaultValue="http">
          <TabsList>
            <TabsTrigger value="http">HTTP</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>
          <TabsContent value="http">
            <CodeBlock language="bash">
{`curl https://socrm.dev/v1/schema \\
  -H "Authorization: Bearer $SOCRM_API_KEY"`}
            </CodeBlock>
          </TabsContent>
          <TabsContent value="mcp">
            <CodeBlock language="json">
{`{ "tool": "schema_describe", "args": {} }`}
            </CodeBlock>
          </TabsContent>
        </Tabs>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <History size={20} aria-hidden /> Audit log + undo
        </h2>
        <p className="text-muted-foreground">
          Every successful write inserts a row in{" "}
          <InlineCode>agent_actions</InlineCode> with the operation name, target
          IDs, before/after snapshot, actor, intent, and the idempotency key.
          Reversible operations expose an <InlineCode>action.undo</InlineCode>{" "}
          endpoint that flips the change. Undo is itself idempotent: calling it
          twice yields the same state.
        </p>
        <CodeBlock language="bash">
{`curl https://socrm.dev/v1/action.undo \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -d '{ "actionId": "act_01H...", "intent": "rollback bad import" }'`}
        </CodeBlock>
        <p className="text-muted-foreground">
          Read more in{" "}
          <Link href="/docs/concepts/audit-log" className="underline text-foreground">
            <Undo2 size={14} className="inline -mt-0.5" aria-hidden /> Audit log
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
