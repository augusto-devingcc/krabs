"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyAccountId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <span className="inline-flex items-center gap-2">
      <code className="font-mono text-xs text-foreground">{value}</code>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
        }}
        className="font-mono uppercase tracking-wide"
      >
        {copied ? (
          <>
            <Check size={12} aria-hidden /> copied
          </>
        ) : (
          <>
            <Copy size={12} aria-hidden /> copy
          </>
        )}
      </Button>
    </span>
  );
}
