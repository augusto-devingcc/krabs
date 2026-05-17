"use client";

import { useState, useTransition } from "react";
import { sendTestEmailAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SendTestEmail({
  defaultTo,
  defaultFrom,
  disabled,
  disabledReason,
}: {
  defaultTo: string;
  defaultFrom: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setErr(null);
    setOkMsg(null);
    startTransition(async () => {
      const r = await sendTestEmailAction(formData);
      if ("error" in r) {
        setErr(r.error);
      } else {
        setOkMsg(`Sent. Resend message id: ${r.messageId}`);
      }
    });
  }

  if (disabled) {
    return (
      <Alert>
        <AlertDescription className="font-mono">
          {disabledReason ?? "Verify a sending domain to enable test emails."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resend-test-from" className="k-eyebrow">
            from
          </Label>
          <Input
            id="resend-test-from"
            name="from"
            defaultValue={defaultFrom}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resend-test-to" className="k-eyebrow">
            to
          </Label>
          <Input
            id="resend-test-to"
            name="to"
            type="email"
            defaultValue={defaultTo}
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resend-test-subject" className="k-eyebrow">
          subject
        </Label>
        <Input
          id="resend-test-subject"
          name="subject"
          defaultValue="Hello from krabs.dev"
          required
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resend-test-body" className="k-eyebrow">
          body
        </Label>
        <textarea
          id="resend-test-body"
          name="body"
          defaultValue="This is a test email sent through krabs.dev via Resend."
          required
          rows={4}
          className="border border-border rounded px-3 py-2 text-sm font-mono"
        />
      </div>

      {err && (
        <Alert variant="destructive">
          <AlertDescription className="font-mono">{err}</AlertDescription>
        </Alert>
      )}
      {okMsg && (
        <Alert>
          <AlertDescription className="font-mono">{okMsg}</AlertDescription>
        </Alert>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="k-btn k-btn--primary k-btn--md"
        >
          {pending ? "Sending…" : "Send test email"}
        </button>
      </div>
    </form>
  );
}
