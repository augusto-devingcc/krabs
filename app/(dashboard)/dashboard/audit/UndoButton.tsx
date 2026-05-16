"use client";

import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { undoActionFromWeb } from "./actions";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      disabled={pending}
      className="font-mono"
    >
      <Undo2 size={12} aria-hidden />
      {pending ? "undoing…" : "undo"}
    </Button>
  );
}
