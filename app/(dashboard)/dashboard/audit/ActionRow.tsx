"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { UndoButton } from "./UndoButton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type Reversibility = "reversible" | "one-way" | "read-only";

export type AuditRow = {
  id: string;
  apiKeyId: string;
  operation: string;
  targetKind: string;
  targetId: string;
  intent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  reversibility: Reversibility;
};

export function ActionRow({ a }: { a: AuditRow }) {
  const [open, setOpen] = useState(false);

  const time = fmtTime(a.createdAt);
  const shortKey = a.apiKeyId.slice(0, 8);

  return (
    <div className="hover:bg-accent/50 transition-colors">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-2 grid grid-cols-12 gap-3 items-center focus:outline-none focus:bg-accent/50"
      >
        <span className="col-span-1 text-muted-foreground tabular-nums">{time}</span>
        <span className="col-span-2 text-muted-foreground truncate" title={a.apiKeyId}>
          {shortKey}
        </span>
        <span className="col-span-2 text-foreground truncate">{a.operation}</span>
        <span
          className="col-span-3 text-muted-foreground truncate"
          title={`${a.targetKind}:${a.targetId}`}
        >
          {a.targetKind}:{a.targetId.slice(0, 8)}
        </span>
        <span className="col-span-3 text-foreground truncate" title={a.intent ?? ""}>
          {a.intent ?? <span className="text-muted-foreground">no intent</span>}
        </span>
        <span className="col-span-1 text-right" onClick={(e) => e.stopPropagation()}>
          {a.reversibility === "reversible" ? (
            <UndoButton actionId={a.id} operation={a.operation} />
          ) : a.reversibility === "one-way" ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              <Lock size={10} aria-hidden /> one-way
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">read-only</span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 bg-muted border-t border-border">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-muted-foreground">
            <Field label="action id" value={a.id} />
            <Field label="api key" value={a.apiKeyId} />
            <Field label="target" value={`${a.targetKind}:${a.targetId}`} />
            <Field label="created" value={a.createdAt} />
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            metadata
          </p>
          <ScrollArea className="max-h-64 bg-background border border-border rounded-md">
            <pre className="p-3 font-mono text-foreground text-xs">
              {a.metadata ? JSON.stringify(a.metadata, null, 2) : "null"}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[80px]">{label}</span>
      <span className="text-foreground truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(11, 19);
}
