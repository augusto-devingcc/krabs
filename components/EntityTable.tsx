import Link from "next/link";

export function EntityHeader({
  title,
  description,
  count,
  actions,
}: {
  title: string;
  description: string;
  count: number;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <p className="font-mono text-xs uppercase tracking-wider text-[var(--color-fg-faint)] mb-3">
        # {title}
      </p>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="mb-3">
        <span className="inline-block font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg-muted)]">
          {count} {count === 1 ? "record" : "records"}
        </span>
      </div>
      <p className="text-sm text-[var(--color-fg-muted)] max-w-2xl leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export function EntityEmpty({
  prompt,
  description,
}: {
  prompt: string;
  description?: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] py-12 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-faint)] mb-4">
        empty
      </p>
      {description && (
        <p className="text-sm text-[var(--color-fg-muted)] max-w-md mx-auto mb-6 leading-relaxed">
          {description}
        </p>
      )}
      <div className="inline-block bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-4 py-3 text-left max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-faint)] mb-1">
          try asking your agent
        </p>
        <code className="font-mono text-sm text-[var(--color-fg)]">
          <span className="text-[var(--color-fg-muted)]">›</span> {prompt}
        </code>
      </div>
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
    <th className="sticky top-0 text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-medium text-[var(--color-fg-faint)] bg-[var(--color-surface-2)] border-b border-[var(--color-border-strong)]">
      {children}
    </th>
  );
}

export function Td({
  children,
  mono,
  muted,
  faint,
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  faint?: boolean;
}) {
  const classes = [
    "px-4 py-3 align-middle",
    mono ? "font-mono text-xs" : "",
    faint ? "text-[var(--color-fg-faint)]" : muted ? "text-[var(--color-fg-muted)]" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <td className={classes}>{children}</td>;
}

export function Tr({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  if (href) {
    return (
      <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer">
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
  return (
    <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors">
      {children}
    </tr>
  );
}

/**
 * RowLink — a clickable table row helper. Renders a row that visually highlights
 * on hover and navigates to `href`. Uses a real <Link> nested via colSpan to
 * keep the whole row clickable while staying in valid markup.
 */
export function RowLink({
  href,
  children,
  cols = 20,
}: {
  href: string;
  children: React.ReactNode;
  cols?: number;
}) {
  return (
    <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer">
      <td colSpan={cols} className="p-0">
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

export function StatusPill({
  status,
  tone = "default",
}: {
  status: string;
  tone?: "muted" | "strong" | "default";
}) {
  const tones: Record<string, string> = {
    default:
      "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-fg-muted)]",
    muted:
      "bg-transparent border-[var(--color-border)] text-[var(--color-fg-faint)]",
    strong:
      "bg-[var(--color-surface-2)] border-[var(--color-border-strong)] text-[var(--color-fg)]",
  };
  return (
    <span
      className={`inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded border ${tones[tone]}`}
    >
      {status}
    </span>
  );
}
