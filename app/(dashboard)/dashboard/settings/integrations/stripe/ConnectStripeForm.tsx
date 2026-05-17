"use client";

import { useState, useTransition } from "react";
import { connectStripeAction } from "./actions";

export function ConnectStripeForm() {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setErr(null);
    startTransition(async () => {
      const r = await connectStripeAction(formData);
      if ("error" in r) setErr(r.error);
    });
  }

  return (
    <form action={onSubmit} className="st-form">
      <div className="st-row">
        <div>
          <label htmlFor="stripe-display-name" className="st-row__lbl">
            display name <span className="st-row__hint--inline">(optional)</span>
          </label>
          <div className="st-row__hint">Shown in this dashboard so you can tell accounts apart.</div>
        </div>
        <div className="st-row__v">
          <label className="st-input">
            <input
              id="stripe-display-name"
              name="displayName"
              placeholder="Acme Stripe"
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      <div className="st-row">
        <div>
          <label htmlFor="stripe-secret" className="st-row__lbl">restricted API key</label>
          <div className="st-row__hint">
            Paste a Restricted Key from your Stripe Dashboard. krabs registers the
            webhook in your Stripe automatically.
          </div>
        </div>
        <div className="st-row__v">
          <label className="st-input st-input--mono">
            <input
              id="stripe-secret"
              name="secretKey"
              type="password"
              placeholder="rk_live_..."
              required
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
      </div>

      <details className="st-help">
        <summary>required permissions</summary>
        <ul className="st-help__perms">
          <PermRow scope="Webhook Endpoints" level="Write" />
          <PermRow scope="Customers" level="Read" />
          <PermRow scope="Subscriptions" level="Read" />
          <PermRow scope="Invoices" level="Read" />
          <PermRow scope="Charges" level="Read" />
          <PermRow scope="Refunds" level="Read" />
          <PermRow scope="Products" level="Read" />
          <PermRow scope="Prices" level="Read" />
        </ul>
      </details>

      <details className="st-help">
        <summary>how to create a restricted key</summary>
        <ol>
          <li>
            In your Stripe Dashboard, go to{" "}
            <a
              href="https://dashboard.stripe.com/apikeys/create"
              target="_blank"
              rel="noreferrer noopener"
            >
              Developers → API keys → Create restricted key
            </a>
            .
          </li>
          <li>Name it &ldquo;krabs.dev&rdquo; so it&apos;s easy to revoke later.</li>
          <li>Enable each permission listed above at the level shown.</li>
          <li>
            Click <code>Create key</code> and copy the <code>rk_live_...</code> value.
          </li>
          <li>Paste it above and connect.</li>
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
          {pending ? "Connecting…" : "Connect Stripe"}
        </button>
      </div>
    </form>
  );
}

function PermRow({ scope, level }: { scope: string; level: "Read" | "Write" }) {
  return (
    <li>
      <span className={`k-pip k-pip--${level === "Write" ? "accent" : "neutral"}`}>
        {level}
      </span>
      <span>{scope}</span>
    </li>
  );
}
