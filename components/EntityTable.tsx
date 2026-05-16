import type { LucideIcon } from "lucide-react";
// Default icon fallbacks used when no icon prop is passed.
import { Inbox, Sparkles } from "lucide-react";
import {
  Table as ShadTable,
  TableHeader as ShadTableHeader,
  TableBody as ShadTableBody,
  TableHead as ShadTableHead,
  TableRow as ShadTableRow,
  TableCell as ShadTableCell,
  TableCaption as ShadTableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/lib/utils";

export function EntityHeader({
  title,
  description,
  count,
  actions,
  icon: Icon,
}: {
  title: string;
  description: string;
  count: number;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  const ResolvedIcon: LucideIcon = Icon ?? Sparkles;
  return (
    <div className="mb-8">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">
        # {title}
      </p>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <ResolvedIcon
            size={24}
            className="text-muted-foreground"
            aria-hidden
          />
          <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      <div className="mb-3">
        <Badge variant="secondary">
          {count} {count === 1 ? "record" : "records"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export function EntityEmpty({
  prompt,
  description,
  icon: Icon,
}: {
  prompt: string;
  description?: string;
  icon?: LucideIcon;
}) {
  const ResolvedIcon: LucideIcon = Icon ?? Inbox;
  return (
    <Card>
      <CardContent className="py-12 text-center flex flex-col items-center">
        <ResolvedIcon
          size={48}
          className="text-muted-foreground mb-4"
          aria-hidden
        />
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
          empty
        </p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
            {description}
          </p>
        )}
        <div className="inline-block bg-muted border-border border rounded-md px-4 py-3 text-left max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            try asking your agent
          </p>
          <code className="font-mono text-sm text-foreground">
            <span className="text-muted-foreground">›</span> {prompt}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}

// Re-export shadcn table primitives under expected names
export const Table = ShadTable;
export const TableHeader = ShadTableHeader;
export const TableBody = ShadTableBody;
export const TableHead = ShadTableHead;
export const TableRow = ShadTableRow;
export const TableCell = ShadTableCell;
export const TableCaption = ShadTableCaption;

// Legacy helpers — kept as thin wrappers so existing callers keep working.
export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <ShadTableHead className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
      {children}
    </ShadTableHead>
  );
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
    <ShadTableCell
      className={cn(
        "px-4 py-3 align-middle",
        mono && "font-mono text-xs",
        (faint || muted) && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </ShadTableCell>
  );
}

/**
 * Tr — table row. If `href` is provided, renders as a clickable row.
 * The href is currently informational; callers should also wrap individual
 * cell contents in a <Link> for actual navigation.
 */
export function Tr({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  if (href) {
    return <RowLink href={href}>{children}</RowLink>;
  }
  return <ShadTableRow>{children}</ShadTableRow>;
}

/**
 * RowLink — a clickable-styled table row. Renders a TableRow with
 * cursor-pointer and a muted hover state. Pair with a <Link> in the first
 * cell to make the row actually navigate.
 */
export function RowLink({
  href: _href,
  children,
}: {
  href: string;
  children: React.ReactNode;
  cols?: number;
}) {
  return (
    <ShadTableRow className="cursor-pointer hover:bg-muted/50">
      {children}
    </ShadTableRow>
  );
}

/**
 * StatusPill — thin wrapper over shadcn Badge with `variant` instead of the
 * legacy `tone` prop. Callers can still pass `tone` and it is mapped.
 */
export function StatusPill({
  status,
  variant,
  tone,
}: {
  status: string;
  variant?: "default" | "secondary" | "outline";
  tone?: "muted" | "strong" | "default";
}) {
  const resolved: "default" | "secondary" | "outline" =
    variant ??
    (tone === "muted"
      ? "outline"
      : tone === "strong"
      ? "default"
      : "secondary");
  return (
    <Badge variant={resolved} className="font-mono text-[11px]">
      {status}
    </Badge>
  );
}
