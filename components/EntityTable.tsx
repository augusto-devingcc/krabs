import Link from "next/link";

export function EntityHeader({
  title,
  description,
  count,
  examplePrompt,
}: {
  title: string;
  description: string;
  count: number;
  examplePrompt: string;
}) {
  return (
    <div className="mb-8">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-2"># {title}</p>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-3xl font-medium">{title}</h1>
        <span className="font-mono text-sm text-[var(--color-fg-muted)]">{count}</span>
      </div>
      <p className="text-[var(--color-fg-muted)] max-w-2xl mb-4">{description}</p>
      {count === 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 max-w-2xl">
          <p className="text-sm text-[var(--color-fg-muted)] mb-2">
            <span className="text-[var(--color-accent)] font-mono">›</span> ask your agent:
          </p>
          <code className="text-sm font-mono">{examplePrompt}</code>
        </div>
      )}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2 text-xs uppercase tracking-wide font-medium text-[var(--color-fg-muted)] bg-[var(--color-surface-2)]">
      {children}
    </th>
  );
}

export function Td({
  children,
  mono,
  muted,
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  const c = mono ? "font-mono text-xs" : "";
  const m = muted ? "text-[var(--color-fg-muted)]" : "";
  return <td className={`px-4 py-2.5 ${c} ${m}`}>{children}</td>;
}

export function Tr({ children, href }: { children: React.ReactNode; href?: string }) {
  if (href) {
    return (
      <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] cursor-pointer">
        <td colSpan={20} className="p-0">
          <Link href={href} className="block">
            <table className="w-full">
              <tbody>
                <tr>{children}</tr>
              </tbody>
            </table>
          </Link>
        </td>
      </tr>
    );
  }
  return <tr className="border-t border-[var(--color-border)]">{children}</tr>;
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg-muted)]">
      {status}
    </span>
  );
}
