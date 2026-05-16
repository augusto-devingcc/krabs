"use client";

import { useEffect, useState, useTransition } from "react";
import { createKeyAction } from "./actions";

export function KeyCreator({ embedded = false }: { embedded?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ token: string; label: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function onSubmit(formData: FormData) {
    setErr(null);
    setCreated(null);
    startTransition(async () => {
      const r = await createKeyAction(formData);
      if ("error" in r) setErr(r.error);
      else setCreated({ token: r.token, label: r.label });
    });
  }

  function onCopy() {
    if (!created) return;
    navigator.clipboard.writeText(created.token);
    setCopied(true);
  }

  const wrapperClass = embedded
    ? "mb-0"
    : "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 mb-6";

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
          # new api key
        </p>
      )}
      <form action={onSubmit} className="flex gap-3">
        <input
          name="label"
          placeholder="Claude Desktop on MacBook"
          required
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-fg)]"
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
        <div className="mt-5 bg-[var(--color-surface-2)] border border-[var(--color-fg)] rounded-[var(--radius-md)] p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
            ✓ token created
          </p>
          <p className="text-sm mb-4 text-[var(--color-fg)]">
            <span className="font-mono">{created.label}</span> is ready. Copy this token now —
            it&apos;s shown <strong>once</strong> and never again.
          </p>
          <div className="flex gap-2 items-stretch">
            <code className="flex-1 font-mono text-sm bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] px-4 py-3 overflow-x-auto whitespace-nowrap">
              {created.token}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="text-xs font-mono px-4 py-3 bg-[var(--color-accent)] text-[var(--color-bg)] rounded-[var(--radius-sm)] hover:bg-[var(--color-accent-hover)] min-w-[100px]"
            >
              {copied ? "copied ✓" : "copy"}
            </button>
          </div>
          <details open className="mt-5 text-xs text-[var(--color-fg-muted)] group">
            <summary className="cursor-pointer font-mono uppercase tracking-wide hover:text-[var(--color-fg)] select-none">
              › quick start — Claude Desktop config
            </summary>
            <pre className="mt-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-4 overflow-x-auto text-[var(--color-fg)]">{`{
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
