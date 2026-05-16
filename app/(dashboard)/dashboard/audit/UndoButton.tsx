"use client";

import { useTransition } from "react";
import { undoActionFromWeb } from "./actions";

export function UndoButton({ actionId, operation }: { actionId: string; operation: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(`Undo "${operation}"? This is itself logged in the audit trail.`);
    if (!ok) return;
    startTransition(async () => {
      const r = await undoActionFromWeb(actionId);
      if ("error" in r) alert(r.error);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50 font-mono"
    >
      {pending ? "undoing…" : "↺ undo"}
    </button>
  );
}
