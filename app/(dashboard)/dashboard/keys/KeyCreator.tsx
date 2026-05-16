"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Code2, Copy, Plus, Sparkles } from "lucide-react";
import { createKeyAction } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  const formAndResult = (
    <>
      <form action={onSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full space-y-1.5">
          <Label htmlFor="key-label" className="text-xs uppercase tracking-wide text-muted-foreground">
            Label
          </Label>
          <Input
            id="key-label"
            name="label"
            placeholder="Claude Desktop on MacBook"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Sparkles size={16} aria-hidden className="animate-pulse" />
              creating…
            </>
          ) : (
            "create key"
          )}
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
              <span className="font-mono">{created.label}</span> is ready. Copy this token now —
              it&apos;s shown <strong>once</strong> and never again.
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
                  <>
                    <Check size={16} aria-hidden /> copied
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden /> copy
                  </>
                )}
              </Button>
            </div>
            <details open className="mt-4 text-xs text-muted-foreground group">
              <summary className="cursor-pointer font-mono uppercase tracking-wide hover:text-foreground select-none inline-flex items-center gap-2">
                <Code2 size={14} aria-hidden />
                quick start — Claude Desktop config
              </summary>
              <pre className="mt-3 bg-background border border-border rounded-md p-4 overflow-x-auto text-foreground">{`{
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
          </AlertDescription>
        </Alert>
      )}
    </>
  );

  if (embedded) {
    return <div>{formAndResult}</div>;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plus size={20} className="text-muted-foreground" aria-hidden />
          <CardTitle>New API key</CardTitle>
        </div>
        <CardDescription>
          Name it for the agent or device using it — the audit log will show this label.
        </CardDescription>
      </CardHeader>
      <CardContent>{formAndResult}</CardContent>
    </Card>
  );
}
