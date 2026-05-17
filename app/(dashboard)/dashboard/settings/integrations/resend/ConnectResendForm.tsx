"use client";

import { useState, useTransition } from "react";
import { connectResendAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resend-display-name" className="k-eyebrow">
          display name <span className="text-muted-foreground normal-case">(optional)</span>
        </Label>
        <Input
          id="resend-display-name"
          name="displayName"
          placeholder="Acme Resend"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Shown in this dashboard so you can tell accounts apart.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resend-secret" className="k-eyebrow">
          API key
        </Label>
        <Input
          id="resend-secret"
          name="secretKey"
          type="password"
          placeholder="re_..."
          required
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Paste an API key from your Resend Dashboard. krabs uses it to register
          domains and send email on your behalf.
        </p>

        <details className="mt-2 text-xs text-muted-foreground group">
          <summary className="cursor-pointer k-eyebrow hover:text-foreground select-none">
            how to create a Resend API key
          </summary>
          <ol className="mt-3 pl-5 space-y-2 list-decimal">
            <li>
              In your Resend Dashboard, go to{" "}
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-foreground"
              >
                API Keys &rarr; Create API Key
              </a>
              .
            </li>
            <li>Name it &ldquo;krabs.dev&rdquo; so it&apos;s easy to revoke later.</li>
            <li>Grant <span className="font-mono">Full access</span> so krabs can manage domains.</li>
            <li>
              Copy the <span className="font-mono">re_...</span> value, paste it above, and connect.
            </li>
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
          {pending ? "Connecting…" : "Connect Resend"}
        </button>
      </div>
    </form>
  );
}
