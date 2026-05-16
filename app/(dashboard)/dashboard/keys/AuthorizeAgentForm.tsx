"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AuthorizeAgentForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.trim();
    startTransition(() => {
      if (trimmed.length === 0) {
        router.push("/device");
      } else {
        router.push(`/device?code=${encodeURIComponent(trimmed)}`);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col sm:flex-row gap-3 items-end"
    >
      <div className="flex flex-col gap-1.5 flex-1 w-full">
        <Label htmlFor="device-code" className="k-eyebrow">
          device code
        </Label>
        <Input
          id="device-code"
          name="code"
          placeholder="WDJB-MJHT"
          maxLength={20}
          autoComplete="off"
          autoCapitalize="characters"
          className="font-mono uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Opening…" : "Approve agent"}
      </Button>
    </form>
  );
}
