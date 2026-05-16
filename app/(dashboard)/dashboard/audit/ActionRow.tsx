"use client";

import { useState } from "react";
import { UndoButton } from "./UndoButton";

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
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-2 grid grid-cols-12 gap-3 items-center hover:bg-[var(--color-surface)] focus:outline-none focus:bg-[var(--color-surface)]"
      >
        <span className="col-span-1 text-[var(--color-fg-faint)] tabular-nums">{time}</span>
        <span
          className="col-span-2 text-[var(--color-fg-muted)] truncate"
          title={a.apiKeyId}
        >
          {shortKey}
        </span>
        <span className="col-span-2 text-[var(--color-fg)] truncate">{a.operation}</span>
        <span
          className="col-span-3 text-[var(--color-fg-muted)] truncate"
          title={`${a.targetKind}:${a.targetId}`}
        >
          {a.targetKind}:{a.targetId.slice(0, 8)}
        </span>
        <span
          className="col-span-3 text-[var(--color-fg)] truncate"
          title={a.intent ?? ""}
        >
          {a.intent ?? <span className="text-[var(--color-fg-faint)]">no intent</span>}
        </span>
        <span className="col-span-1 text-right" onClick={(e) => e.stopPropagation()}>
          {a.reversibility === "reversible" ? (
            <UndoButton actionId={a.id} operation={a.operation} />
          ) : a.reversibility === "one-way" ? (
            <span className="text-[var(--color-fg-faint)]">one-way</span>
          ) : (
            <span className="text-[var(--color-fg-faint)]">read-only</span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-[var(--color-fg-muted)]">
            <Field label="action id" value={a.id} />
            <Field label="api key" value={a.apiKeyId} />
            <Field label="target" value={`${a.targetKind}:${a.targetId}`} />
            <Field label="created" value={a.createdAt} />
          </div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-fg-faint)] mb-1">
            metadata
          </p>
          <pre className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 overflow-x-auto text-[var(--color-fg)]">
            {a.metadata ? JSON.stringify(a.metadata, null, 2) : "null"}
          </pre>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--color-fg-faint)] min-w-[80px]">{label}</span>
      <span className="text-[var(--color-fg)] truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(11, 19);
}
