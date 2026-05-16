import {
  Building2,
  CheckSquare,
  CircleDot,
  FileText,
  KeyRound,
  Mail,
  Network,
  StickyNote,
  Tag,
  UploadCloud,
  Users,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/docs/page-header";
import { InlineCode } from "@/components/docs/code-block";
import { Note } from "@/components/docs/note";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type OpFlag = "destructive" | "reversible" | "idempotent" | "dryRun" | "read";

type Operation = {
  name: string;
  description: string;
  flags: OpFlag[];
};

type Group = {
  title: string;
  icon: LucideIcon;
  summary: string;
  operations: Operation[];
};

const groups: Group[] = [
  {
    title: "Schema",
    icon: FileText,
    summary: "Self-describing contract dump for tooling and agents.",
    operations: [
      {
        name: "schema.describe",
        description:
          "Return the full machine-readable operation catalog with JSON schemas and flags.",
        flags: ["read", "idempotent"],
      },
    ],
  },
  {
    title: "Account",
    icon: Building2,
    summary: "Manage the workspace itself.",
    operations: [
      {
        name: "account.update",
        description: "Change the workspace name, contact email, or default timezone.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "account.export",
        description: "Generate a full account archive in JSON for backup or migration.",
        flags: ["read"],
      },
    ],
  },
  {
    title: "API keys",
    icon: KeyRound,
    summary: "Mint and revoke credentials for agents.",
    operations: [
      {
        name: "api_key.create",
        description: "Create a new API key with a name and optional scope. The secret is shown once.",
        flags: ["idempotent", "dryRun"],
      },
      {
        name: "api_key.list",
        description: "List all keys with metadata: name, actor, last used, created.",
        flags: ["read"],
      },
      {
        name: "api_key.revoke",
        description: "Disable a key immediately. Subsequent requests with it return 401.",
        flags: ["destructive", "idempotent"],
      },
    ],
  },
  {
    title: "Contacts",
    icon: Users,
    summary: "People and organizations you track.",
    operations: [
      {
        name: "contact.create",
        description: "Create a contact with name, primary email, and optional identities.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "contact.get",
        description: "Fetch a single contact by ID, including identities and recent activity.",
        flags: ["read"],
      },
      {
        name: "contact.list",
        description: "List contacts with cursor pagination, filters, and sort options.",
        flags: ["read"],
      },
      {
        name: "contact.update",
        description: "Patch fields on a contact. Returns the before/after diff in the audit log.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "contact.delete",
        description: "Soft-delete a contact. Recoverable via action.undo within 30 days.",
        flags: ["destructive", "reversible", "idempotent", "dryRun"],
      },
      {
        name: "contact.merge",
        description:
          "Merge a duplicate contact into a primary. Identities and activity move over.",
        flags: ["destructive", "reversible", "dryRun"],
      },
      {
        name: "contact.find_by_identity",
        description: "Indexed lookup by (kind, value). The canonical 'does this person exist' check.",
        flags: ["read"],
      },
    ],
  },
  {
    title: "Identities",
    icon: Network,
    summary: "Channel-specific addresses attached to a contact.",
    operations: [
      {
        name: "identity.add",
        description: "Attach a new (kind, value) to a contact. Conflicts return 409 with the existing owner.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "identity.remove",
        description: "Detach an identity from a contact. The contact itself is unaffected.",
        flags: ["destructive", "reversible", "idempotent"],
      },
      {
        name: "identity.list",
        description: "List identities for a contact, or all identities of a given kind.",
        flags: ["read"],
      },
    ],
  },
  {
    title: "Interactions",
    icon: Mail,
    summary: "Touchpoints with a contact — emails, calls, messages.",
    operations: [
      {
        name: "interaction.create",
        description: "Log an interaction manually with channel, direction, summary, and timestamp.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "interaction.list",
        description: "List interactions for a contact, deal, or workspace with filters.",
        flags: ["read"],
      },
      {
        name: "interaction.delete",
        description: "Soft-delete an interaction. Recoverable for 30 days.",
        flags: ["destructive", "reversible", "idempotent"],
      },
      {
        name: "interaction.ingest_email",
        description:
          "Parse an RFC-822 message and attach it to the matching contact via identity lookup.",
        flags: ["idempotent", "dryRun"],
      },
    ],
  },
  {
    title: "Deals",
    icon: CircleDot,
    summary: "Opportunities moving through your pipeline.",
    operations: [
      {
        name: "deal.create",
        description: "Open a deal with name, value, stage, and associated contacts.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "deal.get",
        description: "Fetch a single deal with its full timeline and linked entities.",
        flags: ["read"],
      },
      {
        name: "deal.list",
        description: "List deals by stage, owner, or contact.",
        flags: ["read"],
      },
      {
        name: "deal.update",
        description: "Patch deal fields — value, stage, expected close date, status.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "deal.delete",
        description: "Soft-delete a deal. Recoverable for 30 days.",
        flags: ["destructive", "reversible", "idempotent"],
      },
    ],
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    summary: "Things you owe a contact or a deal.",
    operations: [
      {
        name: "task.create",
        description: "Create a task with title, due date, owner, and optional contact or deal.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "task.get",
        description: "Fetch a single task by ID.",
        flags: ["read"],
      },
      {
        name: "task.list",
        description: "List tasks with filters by owner, status, due date, or linked entity.",
        flags: ["read"],
      },
      {
        name: "task.update",
        description: "Mark complete, reassign, reschedule, or rewrite the task.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "task.delete",
        description: "Soft-delete a task. Recoverable for 30 days.",
        flags: ["destructive", "reversible", "idempotent"],
      },
    ],
  },
  {
    title: "Notes",
    icon: StickyNote,
    summary: "Free-form text attached to contacts or deals.",
    operations: [
      {
        name: "note.create",
        description: "Attach a note to a contact or deal. Markdown is supported.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "note.get",
        description: "Fetch a single note by ID.",
        flags: ["read"],
      },
      {
        name: "note.list",
        description: "List notes for a contact, deal, or workspace.",
        flags: ["read"],
      },
      {
        name: "note.update",
        description: "Edit the body of a note. Edit history is recorded in the audit log.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "note.delete",
        description: "Soft-delete a note. Recoverable for 30 days.",
        flags: ["destructive", "reversible", "idempotent"],
      },
    ],
  },
  {
    title: "Tags",
    icon: Tag,
    summary: "Lightweight labels for grouping any entity.",
    operations: [
      {
        name: "tag.create",
        description: "Create a tag with a name and optional color.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "tag.list",
        description: "List all tags in the workspace.",
        flags: ["read"],
      },
      {
        name: "tag.update",
        description: "Rename or recolor a tag. Attachments are preserved.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "tag.delete",
        description: "Delete a tag. Attachments are removed; the underlying entities are not touched.",
        flags: ["destructive", "reversible", "idempotent"],
      },
      {
        name: "tag.attach",
        description: "Attach a tag to a contact, deal, task, or note.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "tag.detach",
        description: "Remove a tag from an entity. The tag itself remains.",
        flags: ["reversible", "idempotent"],
      },
    ],
  },
  {
    title: "Import & export",
    icon: UploadCloud,
    summary: "Bulk movement of data in and out.",
    operations: [
      {
        name: "contact.import_csv",
        description:
          "Import a CSV of contacts. Supports column mapping, identity auto-link, and dry-run.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "contact.ingest_vcard",
        description: "Parse a vCard payload and create or merge the contact.",
        flags: ["reversible", "idempotent", "dryRun"],
      },
      {
        name: "contact.export_csv",
        description: "Export contacts to CSV with optional filters and column selection.",
        flags: ["read"],
      },
    ],
  },
  {
    title: "Audit log",
    icon: History,
    summary: "Inspect and reverse past operations.",
    operations: [
      {
        name: "action.get",
        description: "Fetch a single audit row with its full before/after diff and metadata.",
        flags: ["read"],
      },
      {
        name: "action.list",
        description:
          "List audit rows with filters by actor, operation, target, time range, and reversibility.",
        flags: ["read"],
      },
      {
        name: "action.undo",
        description:
          "Reverse a prior action. Idempotent — calling twice on the same action returns the same state.",
        flags: ["reversible", "idempotent"],
      },
    ],
  },
];

function FlagBadges({ flags }: { flags: OpFlag[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.includes("destructive") && (
        <Badge variant="destructive">destructive</Badge>
      )}
      {flags.includes("reversible") && (
        <Badge variant="outline">reversible</Badge>
      )}
      {flags.includes("idempotent") && (
        <Badge variant="secondary">idempotent</Badge>
      )}
      {flags.includes("dryRun") && <Badge variant="outline">dry-run</Badge>}
      {flags.includes("read") && <Badge variant="outline">read</Badge>}
    </div>
  );
}

export default function ApiReferencePage() {
  const total = groups.reduce((acc, g) => acc + g.operations.length, 0);

  return (
    <article className="space-y-10">
      <PageHeader
        eyebrow="Reference"
        title="API reference"
        description={`All ${total} operations exposed by socrm, grouped by entity. Each operation declares whether it is destructive, reversible, idempotent, and whether it supports dry-run.`}
      />

      <Note variant="info" title="One contract, three transports">
        All operations are exposed identically via CLI, MCP, and HTTP. This
        reference describes the HTTP endpoints. The CLI command is{" "}
        <InlineCode>socrm &lt;verb&gt; &lt;args&gt;</InlineCode> and the MCP
        tool name is the operation name with dots replaced by underscores
        (e.g. <InlineCode>contact_find_by_identity</InlineCode>).
      </Note>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">Authentication</h2>
        <p className="text-muted-foreground">
          All requests require <InlineCode>Authorization: Bearer &lt;key&gt;</InlineCode>.
          Mint keys at <InlineCode>/dashboard/keys</InlineCode>. The same key
          works for HTTP, CLI, and MCP — set it as{" "}
          <InlineCode>SOCRM_API_KEY</InlineCode> for the latter two.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">Request shape</h2>
        <p className="text-muted-foreground">
          Every write accepts an <InlineCode>intent</InlineCode> string, an
          optional <InlineCode>idempotencyKey</InlineCode>, and an optional{" "}
          <InlineCode>dryRun</InlineCode> boolean. Read operations are POST so
          that filters and cursors fit in a body rather than a URL.
        </p>
      </section>

      <div className="space-y-12">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.title} className="space-y-4">
              <div className="border-b border-border pb-3">
                <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
                  <Icon size={20} aria-hidden /> {group.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {group.summary}
                </p>
              </div>
              <div className="space-y-3">
                {group.operations.map((op) => (
                  <Card key={op.name} className="p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-mono text-sm font-medium text-foreground">
                          {op.name}
                        </h3>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          {op.description}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <FlagBadges flags={op.flags} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
