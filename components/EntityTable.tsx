import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/lib/utils";

export function EntityHeader({
  title,
  description,
  count,
  actions,
}: {
  title: string;
  description?: string;
  count: number;
  actions?: React.ReactNode;
  // legacy props — kept in signature so callers compile unchanged.
  eyebrow?: string;
  icon?: LucideIcon;
}) {
  return (
    <>
      <div className="center__head">
        <h2 className="center__h capitalize">
          {title}
          <span className="center__count">{count}</span>
        </h2>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      {description && (
        <p className="k-body-sm text-muted-foreground max-w-2xl -mt-5 mb-7">
          {description}
        </p>
      )}
    </>
  );
}

export function EntityEmpty({
  prompt,
  description,
  icon: _Icon,
}: {
  prompt: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="border border-border rounded-md bg-card p-6">
      <p className="k-eyebrow mb-3">empty</p>
      {description && (
        <p className="k-body-sm text-muted-foreground max-w-xl mb-5">
          {description}
        </p>
      )}
      <div className="inline-block max-w-full">
        <p className="k-eyebrow mb-1.5">try asking your agent</p>
        <code className="font-mono text-sm text-foreground inline-block border border-border rounded-md bg-muted px-3 py-2">
          <span className="text-muted-foreground select-none">$ </span>
          {prompt}
        </code>
      </div>
    </div>
  );
}

// Table primitives rendered with the designer's `.dt__table` class.
// API mirrors shadcn's Table so existing callers compile unchanged.
type DivProps = React.HTMLAttributes<HTMLDivElement>;
type TableProps = React.TableHTMLAttributes<HTMLTableElement>;
type SectionProps = React.HTMLAttributes<HTMLTableSectionElement>;
type RowProps = React.HTMLAttributes<HTMLTableRowElement>;
type CellProps = React.TdHTMLAttributes<HTMLTableCellElement>;
type HeadProps = React.ThHTMLAttributes<HTMLTableCellElement>;

export function Table({ className, children, ...rest }: TableProps) {
  return (
    <table className={cn("dt__table", className)} {...rest}>
      {children}
    </table>
  );
}

export function TableHeader({ children, ...rest }: SectionProps) {
  return <thead {...rest}>{children}</thead>;
}

export function TableBody({ children, ...rest }: SectionProps) {
  return <tbody {...rest}>{children}</tbody>;
}

export function TableRow({ className, children, ...rest }: RowProps) {
  return (
    <tr className={className} {...rest}>
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...rest }: HeadProps) {
  return (
    <th className={className} {...rest}>
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...rest }: CellProps) {
  return (
    <td className={className} {...rest}>
      {children}
    </td>
  );
}

export function TableCaption({ className, children, ...rest }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={cn("text-muted-foreground text-xs py-2", className)} {...rest}>
      {children}
    </caption>
  );
}

// Legacy helpers — kept as thin wrappers so existing callers keep working.
export function Th({ children }: { children?: React.ReactNode }) {
  return <th>{children}</th>;
}

export function Td({
  children,
  mono,
  muted,
  faint,
  className,
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  faint?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        mono && "font-mono text-xs",
        (faint || muted) && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  if (href) return <RowLink href={href}>{children}</RowLink>;
  return <tr>{children}</tr>;
}

export function RowLink({
  href: _href,
  children,
}: {
  href: string;
  children: React.ReactNode;
  cols?: number;
}) {
  return <tr className="cursor-pointer">{children}</tr>;
}

// Wrapper div so callers can keep `<Card>...<Table/>...</Card>` style markup
// while we render the table directly with the designer's class.
export function TableShell({ className, children, ...rest }: DivProps) {
  return (
    <div className={cn("w-full", className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * StatusPill — uses the designer's `.k-badge` primitive. Coral is reserved
 * for the single "primary/active" status; everything else is neutral. Callers
 * can pass an explicit tone via `pillTone`, otherwise we infer from the status.
 */
export function StatusPill({
  status,
  variant,
  tone,
  pillTone,
}: {
  status: string;
  variant?: "default" | "secondary" | "outline";
  tone?: "muted" | "strong" | "default";
  pillTone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  let resolved = pillTone ?? inferTone(status);
  if (!pillTone && (variant === "default" || tone === "strong")) {
    resolved = "accent";
  }
  return (
    <span className={`k-badge k-badge--${resolved}`}>
      {resolved === "accent" && <span className="k-badge__dot" />}
      {status}
    </span>
  );
}

function inferTone(
  status: string,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  const s = status.toLowerCase();
  if (
    s === "open" ||
    s === "in_progress" ||
    s === "lead" ||
    s === "new" ||
    s === "active"
  )
    return "accent";
  if (s === "done" || s === "closed" || s === "customer" || s === "won")
    return "success";
  if (s === "high" || s === "negotiation" || s === "proposal") return "warning";
  if (s === "cancelled" || s === "lost" || s === "archived" || s === "revoked")
    return "danger";
  return "neutral";
}
