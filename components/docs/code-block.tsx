import { cn } from "@/components/lib/utils";
import type { ReactNode } from "react";

export function CodeBlock({
  children,
  language,
  className,
}: {
  children: ReactNode;
  language?: string;
  className?: string;
}) {
  return (
    <div className={cn("my-4 overflow-hidden rounded-lg border border-border bg-muted/40", className)}>
      {language ? (
        <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-1.5">
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {language}
          </span>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-foreground">{children}</code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">
      {children}
    </code>
  );
}
