"use client";

import { useEffect, useState } from "react";

export function CopyAccountId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <span className="inline-flex items-center gap-2">
      <code className="font-mono text-xs text-[var(--color-fg)]">{value}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
        }}
        className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 border border-[var(--color-border-strong)] rounded text-[var(--color-fg-muted)] hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </span>
  );
}
