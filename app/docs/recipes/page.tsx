import Link from "next/link";
import { ChefHat, History, Inbox, Network, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/docs/page-header";
import { CodeBlock, InlineCode } from "@/components/docs/code-block";
import { Note } from "@/components/docs/note";

export default function RecipesPage() {
  return (
    <article className="space-y-10">
      <PageHeader
        eyebrow="Cookbook"
        title="Recipes"
        description="Short, end-to-end runbooks for the things agents actually do. Copy them, adapt them, paste them into your agent prompt or shell history."
      />

      <section className="space-y-3 text-muted-foreground">
        <p>
          Every recipe assumes you have an API key in{" "}
          <InlineCode>SOCRM_API_KEY</InlineCode> and the CLI installed (
          <InlineCode>npx socrm</InlineCode> works too). Recipes prefer the
          CLI for readability but each step maps one-to-one to HTTP and MCP —
          see the <Link href="/docs/api-reference" className="underline text-foreground">API reference</Link>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Inbox size={20} aria-hidden /> Ingest emails from your inbox
        </h2>
        <p className="text-muted-foreground">
          Pipe an RFC-822 message into <InlineCode>interaction.ingest_email</InlineCode>.
          socrm parses the headers, looks the sender up via identity, and
          attaches the message to the right contact. If no contact exists and{" "}
          <InlineCode>autoCreate</InlineCode> is on, one is created in the
          same call.
        </p>
        <CodeBlock language="bash">
{`# From an IMAP fetcher, a Gmail webhook, or a saved .eml file:
cat message.eml | socrm interaction ingest_email \\
  --auto-create \\
  --intent "inbound from primary@gmail.com"

# => { "contactId": "ctc_01H...", "interactionId": "int_01H...", "created": true }`}
        </CodeBlock>
        <p className="text-muted-foreground">
          For a recurring sync, wrap this in a small worker that polls your
          mailbox, dedupes by <InlineCode>Message-ID</InlineCode> via an{" "}
          <InlineCode>idempotency-key</InlineCode>, and skips messages older
          than your cutoff.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Undo2 size={20} aria-hidden /> Roll back a bad batch import
        </h2>
        <p className="text-muted-foreground">
          Always dry-run a CSV before you commit it. If the plan looks right,
          run it for real. If something goes wrong downstream, undo the
          resulting actions by listing them and feeding the IDs into{" "}
          <InlineCode>action.undo</InlineCode>.
        </p>
        <CodeBlock language="bash">
{`# 1. Preview the import.
socrm contact import_csv --file leads.csv --dry-run
# => { "wouldCreate": 142, "wouldUpdate": 7, "wouldSkip": 3, "errors": [] }

# 2. Commit it.
socrm contact import_csv --file leads.csv \\
  --intent "weekly lead drop from marketing" \\
  --idempotency-key "import-2026-05-15"

# 3. Discover something is wrong an hour later? Undo every action from that key.
socrm action list \\
  --idempotency-key "import-2026-05-15" \\
  --json | jq -r '.items[].id' | while read id; do
    socrm action undo --action-id "$id" --intent "rollback bad import"
  done`}
        </CodeBlock>
        <Note variant="warn" title="Order matters">
          Undo in reverse chronological order if your actions touched the same
          rows. <InlineCode>action.list</InlineCode> returns newest first by
          default, which is usually what you want.
        </Note>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Network size={20} aria-hidden /> Dedupe contacts
        </h2>
        <p className="text-muted-foreground">
          The pattern: walk your contacts, look each one up by every identity,
          and merge any hits that point to a different ID. The{" "}
          <InlineCode>find_by_identity</InlineCode> call is indexed, so the
          whole loop is cheap.
        </p>
        <CodeBlock language="bash">
{`socrm contact list --json | jq -c '.items[]' | while read contact; do
  id=$(echo "$contact" | jq -r '.id')

  echo "$contact" | jq -c '.identities[]' | while read identity; do
    kind=$(echo "$identity"  | jq -r '.kind')
    value=$(echo "$identity" | jq -r '.value')

    match=$(socrm contact find_by_identity \\
      --kind "$kind" --value "$value" --json)

    matched_id=$(echo "$match" | jq -r '.contact.id')

    if [ "$matched_id" != "$id" ] && [ "$matched_id" != "null" ]; then
      socrm contact merge \\
        --primary "$matched_id" \\
        --duplicate "$id" \\
        --intent "auto-dedupe via $kind=$value" \\
        --dry-run
    fi
  done
done`}
        </CodeBlock>
        <Note variant="tip">
          Run with <InlineCode>--dry-run</InlineCode> first. Print the proposed
          merges, eyeball them, then drop the flag.
        </Note>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <History size={20} aria-hidden /> Audit your agent fleet
        </h2>
        <p className="text-muted-foreground">
          When more than one agent has a key, you want a regular review of
          what each is doing. <InlineCode>action.list</InlineCode> with an{" "}
          <InlineCode>actor</InlineCode> filter and a time range is enough.
        </p>
        <CodeBlock language="bash">
{`socrm action list \\
  --actor-kind api_key \\
  --since "$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)" \\
  --json \\
  | jq -r '.items[] | [.createdAt, .actor.name, .operation, .intent] | @tsv' \\
  | column -t -s $'\\t'`}
        </CodeBlock>
        <p className="text-muted-foreground">
          Pipe that into your weekly digest. Anything you can&apos;t explain
          gets investigated; anything you don&apos;t like gets undone.
        </p>
      </section>

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <ChefHat size={20} aria-hidden /> More recipes
        </h2>
        <p className="text-muted-foreground">
          Got a workflow you&apos;d like documented? Open an issue on{" "}
          <Link href="https://github.com" className="underline text-foreground">
            GitHub
          </Link>
          {" "}
          with the prompt or shell pipeline you use, and we will adopt it.
        </p>
      </section>
    </article>
  );
}
