"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { createKeyAction } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function KeyCreator({ embedded = false }: { embedded?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ token: string; label: string } | null>(
    null,
  );
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

  const formAndResult = (
    <>
      <form
        action={onSubmit}
        className="flex flex-col sm:flex-row gap-3 items-end"
      >
        <div className="flex flex-col gap-1.5 flex-1 w-full">
          <Label htmlFor="key-label" className="k-eyebrow">
            label
          </Label>
          <Input
            id="key-label"
            name="label"
            placeholder="Claude Desktop on MacBook"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create key"}
        </Button>
      </form>

      {err && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription className="font-mono">{err}</AlertDescription>
        </Alert>
      )}

      {created && (
        <Alert className="mt-5 border-border">
          <Check size={16} aria-hidden />
          <AlertTitle>Token created</AlertTitle>
          <AlertDescription>
            <p className="text-sm mb-3">
              <span className="font-mono">{created.label}</span> is ready. Copy
              this token now — it&apos;s shown <strong>once</strong> and never
              again.
            </p>
            <div className="flex gap-2 items-stretch w-full">
              <code className="flex-1 font-mono text-sm bg-background border border-border rounded-md px-4 py-3 overflow-x-auto whitespace-nowrap">
                {created.token}
              </code>
              <Button
                type="button"
                variant="secondary"
                onClick={onCopy}
                className="min-w-[100px]"
              >
                {copied ? (
                  <Check data-icon="inline-start" aria-hidden />
                ) : (
                  <Copy data-icon="inline-start" aria-hidden />
                )}
                {copied ? "copied" : "copy"}
              </Button>
            </div>
            <details open className="mt-4 text-xs text-muted-foreground group">
              <summary className="cursor-pointer k-eyebrow hover:text-foreground select-none">
                quick start — Claude Desktop config
              </summary>
              <pre className="mt-3 bg-background border border-border rounded-md p-4 overflow-x-auto text-foreground">{`{
  "mcpServers": {
    "krabs": {
      "url": "https://mcp.krabs.dev",
      "auth": { "type": "bearer", "token": "${created.token}" }
    }
  }
}`}</pre>
            </details>
          </AlertDescription>
        </Alert>
      )}
    </>
  );

  if (embedded) {
    return <div>{formAndResult}</div>;
  }

  return (
    <Card
      className="mb-6 border-border rounded-xl"
      style={{ boxShadow: "var(--shadow-1)" }}
    >
      <CardContent className="py-6">
        <p className="k-eyebrow mb-1">new key</p>
        <h2 className="k-h4 mb-1">Create an API key</h2>
        <p className="k-body-sm text-muted-foreground mb-5">
          Name it for the agent or device using it — the audit log will show
          this label.
        </p>
        {formAndResult}
      </CardContent>
    </Card>
  );
}
