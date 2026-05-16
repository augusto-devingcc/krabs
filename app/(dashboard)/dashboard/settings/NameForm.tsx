"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateAccountAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
      <div className="space-y-1.5">
        <Label htmlFor="account-name" className="text-xs uppercase tracking-wide text-muted-foreground">
          account name
        </Label>
        <Input
          id="account-name"
          name="name"
          defaultValue={initial}
          placeholder="optional"
          className="max-w-md"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "saving…" : "save"}
        </Button>
        {ok && (
          <span className="inline-flex items-center gap-1 text-sm text-foreground">
            <Check size={14} aria-hidden />
            saved
          </span>
        )}
        {err && <span className="text-sm text-destructive">{err}</span>}
      </div>
    </form>
  );
}
