import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <header className="mb-10 border-b border-border pb-6">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground mb-3">
        {eyebrow}
      </p>
      <h1 className="text-4xl font-medium tracking-tight mb-3">{title}</h1>
      <p className="text-lg text-muted-foreground max-w-2xl">{description}</p>
    </header>
  );
}
