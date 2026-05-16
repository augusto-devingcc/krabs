import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/lib/utils";

type Variant = "info" | "warn" | "tip";

const variantConfig: Record<
  Variant,
  { icon: typeof Info; className: string; iconClass: string }
> = {
  info: {
    icon: Info,
    className: "border-border bg-muted/40",
    iconClass: "text-muted-foreground",
  },
  warn: {
    icon: AlertTriangle,
    className: "border-destructive/30 bg-destructive/5",
    iconClass: "text-destructive",
  },
  tip: {
    icon: Lightbulb,
    className: "border-primary/20 bg-primary/5",
    iconClass: "text-primary",
  },
};

export function Note({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: ReactNode;
}) {
  const { icon: Icon, className, iconClass } = variantConfig[variant];
  return (
    <div className={cn("my-6 flex gap-3 rounded-lg border p-4", className)}>
      <Icon
        size={20}
        className={cn("mt-0.5 shrink-0", iconClass)}
        aria-hidden
      />
      <div className="space-y-1 text-sm">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <div className="text-muted-foreground [&_a]:underline">{children}</div>
      </div>
    </div>
  );
}
