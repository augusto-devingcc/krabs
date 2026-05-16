"use client";

import { useState, useTransition } from "react";
import { updateAccountAction } from "./actions";

export function NameForm({ initial }: { initial: string }) {
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    setOk(false);
    startTransition(async () => {
      const r = await updateAccountAction(formData);
      if ("error" in r) setErr(r.error);
      else setOk(true);
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-1">
          account name
        </label>
        <input
          name="name"
          defaultValue={initial}
          placeholder="optional"
          className="w-full max-w-md bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-[var(--color-accent)] text-[var(--color-bg)] px-4 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {pending ? "saving…" : "save"}
        </button>
        {ok && <span className="text-sm text-[var(--color-accent)]">✓ saved</span>}
        {err && <span className="text-sm text-[var(--color-danger)]">✘ {err}</span>}
      </div>
    </form>
  );
}
