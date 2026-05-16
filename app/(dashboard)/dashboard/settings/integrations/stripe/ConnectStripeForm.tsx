"use client";

import { useState, useTransition } from "react";
import { connectStripeAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stripe-display-name" className="k-eyebrow">
          display name <span className="text-muted-foreground normal-case">(optional)</span>
        </Label>
        <Input
          id="stripe-display-name"
          name="displayName"
          placeholder="Acme Stripe"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Shown in this dashboard so you can tell accounts apart.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stripe-secret" className="k-eyebrow">
          restricted API key
        </Label>
        <Input
          id="stripe-secret"
          name="secretKey"
          type="password"
          placeholder="rk_live_..."
          required
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Paste a Restricted Key from your Stripe Dashboard. krabs registers the
          webhook in your Stripe automatically.
        </p>

        <details className="mt-2 text-xs text-muted-foreground group">
          <summary className="cursor-pointer k-eyebrow hover:text-foreground select-none">
            required permissions
          </summary>
          <ul className="mt-3 pl-1 space-y-1.5 list-none">
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

        <details className="mt-1 text-xs text-muted-foreground group">
          <summary className="cursor-pointer k-eyebrow hover:text-foreground select-none">
            how to create a restricted key
          </summary>
          <ol className="mt-3 pl-5 space-y-2 list-decimal">
            <li>
              In your Stripe Dashboard, go to{" "}
              <a
                href="https://dashboard.stripe.com/apikeys/create"
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-foreground"
              >
                Developers &rarr; API keys &rarr; Create restricted key
              </a>
              .
            </li>
            <li>Name it &ldquo;krabs.dev&rdquo; so it&apos;s easy to revoke later.</li>
            <li>Enable each permission listed above at the level shown.</li>
            <li>
              Click <span className="font-mono">Create key</span> and copy the{" "}
              <span className="font-mono">rk_live_...</span> value.
            </li>
            <li>Paste it above and connect.</li>
          </ol>
        </details>
      </div>

      {err && (
        <Alert variant="destructive">
          <AlertDescription className="font-mono">{err}</AlertDescription>
        </Alert>
      )}

      <div>
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
    <li className="flex items-center gap-2 text-foreground">
      <span className="font-mono text-[11px] uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5 min-w-[44px] text-center">
        {level}
      </span>
      <span>{scope}</span>
    </li>
  );
}
