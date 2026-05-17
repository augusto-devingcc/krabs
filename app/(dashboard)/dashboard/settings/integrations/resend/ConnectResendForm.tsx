"use client";

import { useState, useTransition } from "react";
import { connectResendAction } from "./actions";

export function ConnectResendForm() {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setErr(null);
    startTransition(async () => {
      const r = await connectResendAction(formData);
      if ("error" in r) setErr(r.error);
    });
  }

  return (
    <form action={onSubmit} className="st-form">
      <div className="st-row">
        <div>
          <label htmlFor="resend-display-name" className="st-row__lbl">
            display name <span className="st-row__hint--inline">(optional)</span>
          </label>
          <div className="st-row__hint">Shown in this dashboard so you can tell accounts apart.</div>
        </div>
        <div className="st-row__v">
          <label className="st-input">
            <input
              id="resend-display-name"
              name="displayName"
              placeholder="Acme Resend"
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      <div className="st-row">
        <div>
          <label htmlFor="resend-secret" className="st-row__lbl">API key</label>
          <div className="st-row__hint">
            Paste an API key from your Resend Dashboard. krabs uses it to register
            domains and send email on your behalf.
          </div>
        </div>
        <div className="st-row__v">
          <label className="st-input st-input--mono">
            <input
              id="resend-secret"
              name="secretKey"
              type="password"
              placeholder="re_..."
              required
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
      </div>

      <details className="st-help">
        <summary>how to create a Resend API key</summary>
        <ol>
          <li>
            In your Resend Dashboard, go to{" "}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noreferrer noopener"
            >
              API Keys → Create API Key
            </a>
            .
          </li>
          <li>Name it &ldquo;krabs.dev&rdquo; so it&apos;s easy to revoke later.</li>
          <li>
            Grant <code>Full access</code> so krabs can manage domains.
          </li>
          <li>
            Copy the <code>re_...</code> value, paste it above, and connect.
          </li>
        </ol>
      </details>

      {err && (
        <div className="st-alert st-alert--danger" role="alert">
          <code>{err}</code>
        </div>
      )}

      <div className="st-form__actions">
        <button
          type="submit"
          disabled={pending}
          className="k-btn k-btn--primary k-btn--md"
        >
          {pending ? "Connecting…" : "Connect Resend"}
        </button>
      </div>
    </form>
  );
}
