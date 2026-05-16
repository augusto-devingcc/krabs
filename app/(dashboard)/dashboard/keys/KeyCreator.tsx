"use client";

import { useState, useTransition } from "react";
import { createKeyAction } from "./actions";

export function KeyCreator() {
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ token: string; label: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    setCreated(null);
    startTransition(async () => {
      const r = await createKeyAction(formData);
      if ("error" in r) setErr(r.error);
      else setCreated({ token: r.token, label: r.label });
    });
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 mb-6">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-3"># new api key</p>
      <form action={onSubmit} className="flex gap-3">
        <input
          name="label"
          placeholder="Claude Desktop on MacBook"
          required
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-[var(--color-accent)] text-[var(--color-bg)] px-4 py-2 rounded-[var(--radius-sm)] text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {pending ? "creating…" : "create key"}
        </button>
      </form>

      {err && (
        <p className="mt-3 text-sm text-[var(--color-danger)] font-mono">✘ {err}</p>
      )}

      {created && (
        <div className="mt-4 bg-[var(--color-accent-faint)] border border-[var(--color-accent)] rounded-[var(--radius-sm)] p-4">
          <p className="text-sm mb-2 text-[var(--color-fg)]">
            ✓ <span className="font-mono">{created.label}</span> created. Copy this token —
            it&apos;s shown <strong>once</strong>:
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 font-mono text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 overflow-x-auto">
              {created.token}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(created.token)}
              className="text-xs px-3 py-2 border border-[var(--color-border-strong)] rounded hover:border-[var(--color-fg-muted)]"
            >
              copy
            </button>
          </div>
          <details className="mt-3 text-xs text-[var(--color-fg-muted)]">
            <summary className="cursor-pointer font-mono hover:text-[var(--color-fg)]">
              › use this in Claude Desktop config
            </summary>
            <pre className="mt-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 overflow-x-auto">{`{
  "mcpServers": {
    "socrm": {
      "command": "node",
      "args": ["/path/to/socrm-mcp"],
      "env": {
        "SOCRM_API_KEY": "${created.token}",
        "SOCRM_API_URL": "https://solo-agentic-crm.vercel.app"
      }
    }
  }
}`}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
