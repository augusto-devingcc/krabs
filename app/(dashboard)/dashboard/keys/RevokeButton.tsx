"use client";

import { useTransition } from "react";
import { revokeKeyAction } from "./actions";

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
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-[var(--color-danger)] hover:text-[var(--color-danger-hover)] disabled:opacity-50"
    >
      {pending ? "revoking…" : "revoke"}
    </button>
  );
}
