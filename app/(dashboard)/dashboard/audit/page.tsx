import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";
import { listActions } from "../../../../src/domain/contact.js";
import { reversibilityOf } from "../../../../src/domain/action.js";
import { UndoButton } from "./UndoButton";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; apiKeyId?: string; targetId?: string }>;
}) {
  const { ctx } = await getDashboardContext();
  const sp = await searchParams;
  const opts: {
    limit: number;
    targetKind?: string;
    apiKeyId?: string;
    targetId?: string;
  } = { limit: 100 };
  if (sp.kind) opts.targetKind = sp.kind;
  if (sp.apiKeyId) opts.apiKeyId = sp.apiKeyId;
  if (sp.targetId) opts.targetId = sp.targetId;
  const items = await listActions(ctx, opts);

  return (
    <div className="p-8 max-w-6xl">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-2"># audit log</p>
      <h1 className="text-3xl font-medium mb-2">What your agents did</h1>
      <p className="text-[var(--color-fg-muted)] mb-8 max-w-2xl">
        Every mutation — by you, the CLI, the MCP, or any of your agents — is here. Reversible
        ones can be undone with one click. Undoing is itself logged.
      </p>

      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden font-mono text-xs">
        <div className="bg-[var(--color-surface-2)] px-4 py-2 text-[var(--color-fg-faint)] flex items-center gap-3">
          <span>$ socrm action list</span>
          <span className="ml-auto">{items.length} entries</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-fg-muted)]">
              <p className="mb-3">(no actions yet)</p>
              <p className="text-[var(--color-fg-faint)]">
                Once an agent (or you) does anything, it shows up here in real time.
              </p>
            </div>
          ) : (
            items.map((a) => {
              const rev = reversibilityOf(a.operation);
              return (
                <div
                  key={a.id}
                  className="px-4 py-2.5 grid grid-cols-12 gap-3 items-center hover:bg-[var(--color-surface)]"
                >
                  <span className="col-span-2 text-[var(--color-fg-faint)]">
                    {fmt(a.createdAt)}
                  </span>
                  <span className="col-span-2 text-[var(--color-fg-muted)] truncate" title={a.apiKeyId}>
                    {a.apiKeyId.slice(0, 16)}…
                  </span>
                  <span className="col-span-2 text-[var(--color-accent)]">{a.operation}</span>
                  <span className="col-span-2 text-[var(--color-fg-muted)] truncate" title={a.targetId}>
                    {a.targetKind}:{a.targetId.slice(0, 12)}…
                  </span>
                  <span className="col-span-3 text-[var(--color-fg)] truncate" title={a.intent ?? ""}>
                    {a.intent ?? <span className="text-[var(--color-fg-faint)]">no intent</span>}
                  </span>
                  <span className="col-span-1 text-right">
                    {rev === "reversible" ? (
                      <UndoButton actionId={a.id} operation={a.operation} />
                    ) : (
                      <span className="text-[var(--color-fg-faint)]">{rev}</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(11, 19);
}
