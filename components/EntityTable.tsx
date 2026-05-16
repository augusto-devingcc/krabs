import type { LucideIcon } from "lucide-react";
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
  eyebrow,
}: {
  title: string;
  description: string;
  count: number;
  actions?: React.ReactNode;
  eyebrow?: string;
  // icon kept in signature for callers that still pass it; unused.
  icon?: LucideIcon;
}) {
  const resolvedEyebrow = (eyebrow ?? `crm · ${title}`).toLowerCase();
  return (
    <div className="mb-8 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="k-eyebrow mb-2">{resolvedEyebrow}</p>
        <h1 className="k-h2 mb-2 capitalize">{title}</h1>
        <p className="k-body-sm text-muted-foreground max-w-2xl">
          {description}
        </p>
        <div className="mt-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>{count}</span>
          <span>{count === 1 ? "record" : "records"}</span>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

export function EntityEmpty({
  prompt,
  description,
  // icon kept in signature for back-compat; not rendered.
  icon: _Icon,
}: {
  prompt: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card
      className="border-border"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <CardContent className="py-10">
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
    <ShadTableHead className="k-eyebrow font-medium">
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
 * StatusPill — uses Badge with tone-mapped classes. Coral is reserved for the
 * single "primary/active" status; everything else is neutral. Callers can
 * pass an explicit tone via `pillTone`, otherwise we infer from the status.
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
  const inferred = pillTone ?? inferTone(status);
  const klass = TONE_CLASSES[inferred];
  // Map legacy variant/tone to a visual fallback if pillTone wasn't passed.
  if (!pillTone && (variant === "default" || tone === "strong")) {
    // Strong/default callers used to render the active item — escalate to accent.
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-mono text-[11px] uppercase tracking-wide border-transparent",
          TONE_CLASSES.accent,
        )}
      >
        {status}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[11px] uppercase tracking-wide border-transparent",
        klass,
      )}
    >
      {status}
    </Badge>
  );
}

const TONE_CLASSES: Record<
  "neutral" | "accent" | "success" | "warning" | "danger",
  string
> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-coral-50 text-coral-700 dark:bg-coral-900/30 dark:text-coral-300",
  success: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

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
