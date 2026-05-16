"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { revokeKeyAction } from "./actions";
import { Button } from "@/components/ui/button";

export function RevokeButton({ keyId, label }: { keyId: string; label: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      `Revoke "${label}"? The agent using this key loses access on its next request.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await revokeKeyAction(keyId);
      if ("error" in r) alert(r.error);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 size={14} aria-hidden />
      {pending ? "revoking…" : "revoke"}
    </Button>
  );
}
