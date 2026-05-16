import Link from "next/link";
import { KeyRound, Plug, Terminal, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/docs/page-header";
import { CodeBlock, InlineCode } from "@/components/docs/code-block";
import { Note } from "@/components/docs/note";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function GettingStartedPage() {
  return (
    <article className="space-y-10">
      <PageHeader
        eyebrow="Get started"
        title="Getting started"
        description="Five minutes from zero to your first agent-issued write. We will create an account, mint an API key, install the MCP server, and run a few commands."
      />

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <UserPlus size={20} aria-hidden /> 1. Create an account
        </h2>
        <p className="text-muted-foreground">
          Head to{" "}
          <Link href="/sign-up" className="underline text-foreground">
            /sign-up
          </Link>{" "}
          and create your workspace. socrm is single-tenant by account — you
          own the data, the keys, and the audit trail. The free tier is enough
          to run an agent against a few thousand contacts.
        </p>
        <p className="text-muted-foreground">
          Once you have signed in, you land on the dashboard at{" "}
          <InlineCode>/dashboard</InlineCode>. Everything we describe in these
          docs can be issued from there, from the CLI, or from an agent runtime.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <KeyRound size={20} aria-hidden /> 2. Generate an API key
        </h2>
        <p className="text-muted-foreground">
          Visit{" "}
          <Link href="/dashboard/keys" className="underline text-foreground">
            /dashboard/keys
          </Link>{" "}
          and click <strong>New key</strong>. Give it a name that identifies
          which agent will use it — for example <InlineCode>claude-desktop</InlineCode>{" "}
          or <InlineCode>research-bot</InlineCode>. You will see the secret
          exactly once.
        </p>

        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          <p className="font-mono text-xs uppercase tracking-wide">
            screenshot · /dashboard/keys
          </p>
          <p className="mt-2">
            A table of existing keys with a single <strong>New key</strong> button.
            Each key shows its name, the actor that owns it, and the last time it
            was used.
          </p>
        </div>

        <Note variant="warn" title="Treat keys like passwords">
          A key carries the full scope of your account. If you suspect a leak,
          revoke it from the same page — every operation issued with that key
          from that moment on will fail with 401.
        </Note>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Plug size={20} aria-hidden /> 3. Install MCP in Claude Desktop
        </h2>
        <p className="text-muted-foreground">
          Open Claude Desktop, go to <strong>Settings → Developer → Edit Config</strong>,
          and add an entry under <InlineCode>mcpServers</InlineCode>:
        </p>
        <CodeBlock language="json">
{`{
  "mcpServers": {
    "socrm": {
      "command": "npx",
      "args": ["-y", "socrm", "mcp"],
      "env": {
        "SOCRM_API_KEY": "sk_live_..."
      }
    }
  }
}`}
        </CodeBlock>
        <p className="text-muted-foreground">
          Restart Claude Desktop. You should see <InlineCode>socrm</InlineCode> in
          the MCP tools picker with all 46 operations exposed. The same binary
          works as a CLI — run <InlineCode>npx socrm --help</InlineCode> to see it.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Terminal size={20} aria-hidden /> 4. Try your first command
        </h2>
        <p className="text-muted-foreground">
          Pick the transport that fits your workflow. The payload is the same
          shape on all three.
        </p>

        <Tabs defaultValue="mcp" className="w-full">
          <TabsList>
            <TabsTrigger value="mcp">MCP / agent prompt</TabsTrigger>
            <TabsTrigger value="cli">CLI</TabsTrigger>
            <TabsTrigger value="http">HTTP</TabsTrigger>
          </TabsList>

          <TabsContent value="mcp">
            <p className="text-sm text-muted-foreground mb-3">
              Talk to Claude in plain English. The model picks the right tool.
            </p>
            <CodeBlock>
{`You: List my 10 most recently updated contacts.
You: Create a contact named "Ada Lovelace" with email ada@example.com.
You: Undo my last delete.`}
            </CodeBlock>
          </TabsContent>

          <TabsContent value="cli">
            <CodeBlock language="bash">
{`socrm contact list --limit 10
socrm contact create --name "Ada Lovelace" --email ada@example.com
socrm action undo --last`}
            </CodeBlock>
          </TabsContent>

          <TabsContent value="http">
            <CodeBlock language="bash">
{`curl https://socrm.dev/v1/contact.list \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "limit": 10 }'`}
            </CodeBlock>
          </TabsContent>
        </Tabs>

        <Note variant="tip" title="Dry-run anything">
          Pass <InlineCode>--dry-run</InlineCode> on the CLI or{" "}
          <InlineCode>{`{"dryRun": true}`}</InlineCode> in the body to see what
          the operation would do without committing. Every write supports it.
        </Note>
      </section>

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xl font-medium tracking-tight">Next</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            Read{" "}
            <Link href="/docs/concepts/agent-contract" className="underline text-foreground">
              Agent contract
            </Link>{" "}
            to understand the safety primitives.
          </li>
          <li>
            Browse the{" "}
            <Link href="/docs/api-reference" className="underline text-foreground">
              API reference
            </Link>{" "}
            for the full operation catalog.
          </li>
        </ul>
      </section>
    </article>
  );
}
