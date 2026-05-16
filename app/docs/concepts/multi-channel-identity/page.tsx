import Link from "next/link";
import { AtSign, Mail, Network, Phone } from "lucide-react";
import { PageHeader } from "@/components/docs/page-header";
import { CodeBlock, InlineCode } from "@/components/docs/code-block";
import { Note } from "@/components/docs/note";

export default function MultiChannelIdentityPage() {
  return (
    <article className="space-y-10">
      <PageHeader
        eyebrow="Concepts"
        title="Multi-channel identity"
        description="One contact, many handles. Email, phone, Telegram, WhatsApp, LinkedIn, Discord — every reachable address is an identity row pointing at a single contact."
      />

      <section className="space-y-4 text-muted-foreground">
        <p>
          Most real contacts have more than one way to reach them. People
          switch jobs, change numbers, prefer WhatsApp over email, or maintain
          a public LinkedIn alongside a personal Gmail. socrm models that
          explicitly: <InlineCode>contact</InlineCode> is the entity,{" "}
          <InlineCode>identity</InlineCode> is the address. A contact may have
          zero or many identities.
        </p>
        <p>
          The identity table is indexed on the pair{" "}
          <InlineCode>(kind, value)</InlineCode> with a uniqueness constraint
          per account. Two rows with kind <InlineCode>email</InlineCode> and
          value <InlineCode>ada@example.com</InlineCode> cannot exist in the
          same workspace. This is the foundation for dedupe, for email
          ingestion, and for cross-channel routing.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <Network size={20} aria-hidden /> Identity kinds
        </h2>
        <p className="text-muted-foreground">
          The kind enum is open by design — we ship a few canonical kinds and
          you can add your own. Canonical kinds today:
        </p>
        <ul className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <Mail size={14} aria-hidden /> <InlineCode>email</InlineCode>
          </li>
          <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <Phone size={14} aria-hidden /> <InlineCode>phone</InlineCode>
          </li>
          <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <AtSign size={14} aria-hidden /> <InlineCode>telegram</InlineCode>
          </li>
          <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <AtSign size={14} aria-hidden /> <InlineCode>whatsapp</InlineCode>
          </li>
          <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <AtSign size={14} aria-hidden /> <InlineCode>linkedin</InlineCode>
          </li>
          <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <AtSign size={14} aria-hidden /> <InlineCode>discord</InlineCode>
          </li>
        </ul>
        <p className="text-muted-foreground">
          Custom kinds use a namespaced string, e.g.{" "}
          <InlineCode>github</InlineCode> or <InlineCode>internal.crm_id</InlineCode>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">
          Adding and removing identities
        </h2>
        <CodeBlock language="bash">
{`curl https://socrm.dev/v1/identity.add \\
  -H "Authorization: Bearer $SOCRM_API_KEY" \\
  -d '{
    "contactId": "ctc_01H...",
    "kind": "telegram",
    "value": "@ada",
    "intent": "user shared their telegram on a call"
  }'`}
        </CodeBlock>
        <p className="text-muted-foreground">
          A duplicate <InlineCode>(kind, value)</InlineCode> returns{" "}
          <InlineCode>409 IDENTITY_CONFLICT</InlineCode> with the existing
          contact ID in the body. Your agent should either pick the existing
          contact or call <InlineCode>contact.merge</InlineCode>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">
          Indexed lookups
        </h2>
        <p className="text-muted-foreground">
          <InlineCode>contact.find_by_identity</InlineCode> is the canonical
          &quot;does this person already exist&quot; check. It is a single index
          read and returns the contact plus all of its other identities so the
          caller can decide whether to enrich, merge, or skip.
        </p>
        <CodeBlock language="json">
{`POST /v1/contact.find_by_identity
{ "kind": "email", "value": "ada@example.com" }

200 OK
{
  "contact": {
    "id": "ctc_01H...",
    "name": "Ada Lovelace",
    "identities": [
      { "kind": "email",    "value": "ada@example.com" },
      { "kind": "phone",    "value": "+1 555 0199"     },
      { "kind": "telegram", "value": "@ada"            }
    ]
  }
}`}
        </CodeBlock>
        <Note variant="tip">
          Always call <InlineCode>find_by_identity</InlineCode> before{" "}
          <InlineCode>contact.create</InlineCode>. It costs one index lookup
          and prevents the duplicates that haunt every CRM after twelve months
          of agent traffic.
        </Note>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">
          Auto-linking from email ingestion
        </h2>
        <p className="text-muted-foreground">
          <InlineCode>interaction.ingest_email</InlineCode> uses the identity
          index to attach incoming messages without explicit mapping. The
          ingestion pipeline reads the <InlineCode>From</InlineCode> header,
          looks up <InlineCode>(email, value)</InlineCode>, and one of the
          following happens:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>Match.</strong> The interaction is attached to the existing
            contact. No new identity row is written.
          </li>
          <li>
            <strong>No match, autoCreate enabled.</strong> A contact is created
            with that email as its first identity, plus an{" "}
            <InlineCode>interaction</InlineCode> row pointing at it.
          </li>
          <li>
            <strong>No match, autoCreate disabled.</strong> The interaction
            lands in a triage queue with{" "}
            <InlineCode>contactId: null</InlineCode>. An agent can later resolve
            it manually.
          </li>
        </ul>
        <p className="text-muted-foreground">
          The same pattern works for any inbound channel: a Telegram webhook,
          a Discord message, a phone call captured by a voicebot. As long as
          the channel reports a stable handle, identity lookup glues it back to
          the right contact.
        </p>
      </section>

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xl font-medium tracking-tight">Related</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <Link
              href="/docs/recipes"
              className="underline text-foreground"
            >
              Dedupe contacts
            </Link>{" "}
            — a recipe combining <InlineCode>find_by_identity</InlineCode> and{" "}
            <InlineCode>contact.merge</InlineCode>.
          </li>
          <li>
            <Link
              href="/docs/api-reference"
              className="underline text-foreground"
            >
              API reference
            </Link>{" "}
            — full signatures for the identity operations.
          </li>
        </ul>
      </section>
    </article>
  );
}
