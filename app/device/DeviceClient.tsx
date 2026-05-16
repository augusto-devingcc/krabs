"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approveDeviceAction, denyDeviceAction } from "./actions.js";
import type { DeviceActionResult } from "./actions.js";

type Outcome =
  | { kind: "idle" }
  | { kind: "approved" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

function errorMessage(err: Exclude<DeviceActionResult, { ok: true }>["error"]): string {
  switch (err) {
    case "expired":
      return "This code expired before you could approve it. Ask the agent to start over.";
    case "denied":
      return "This code was already denied.";
    case "approved":
      return "This code was already used.";
    case "not_found":
      return "Code not recognized.";
    case "invalid":
      return "Something went wrong. Try again.";
  }
}

export function DeviceClient({ userCode }: { userCode: string }) {
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const onApprove = () => {
    const fd = new FormData();
    fd.set("userCode", userCode);
    startTransition(async () => {
      const res = await approveDeviceAction(fd);
      if (res.ok) {
        setOutcome({ kind: "approved" });
      } else {
        setOutcome({ kind: "error", message: errorMessage(res.error) });
      }
    });
  };

  const onDeny = () => {
    const fd = new FormData();
    fd.set("userCode", userCode);
    startTransition(async () => {
      const res = await denyDeviceAction(fd);
      if (res.ok) {
        setOutcome({ kind: "denied" });
      } else {
        setOutcome({ kind: "error", message: errorMessage(res.error) });
      }
    });
  };

  if (outcome.kind === "approved") {
    return (
      <ResultState
        heading="Device authorized"
        body="The agent now has a long-lived bearer token bound to your workspace. You can close this tab."
      />
    );
  }

  if (outcome.kind === "denied") {
    return (
      <ResultState
        heading="Device denied"
        body="The agent will not receive a token. You can close this tab."
      />
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
        <button
          type="button"
          onClick={onApprove}
          disabled={isPending}
          className="mk-btn mk-btn--primary mk-btn--lg"
          style={{ flex: 1 }}
        >
          {isPending ? "Working..." : "Allow"}
        </button>
        <button
          type="button"
          onClick={onDeny}
          disabled={isPending}
          className="mk-btn mk-btn--secondary mk-btn--lg"
          style={{ flex: 1 }}
        >
          Deny
        </button>
      </div>
      <p
        style={{
          marginTop: 18,
          fontSize: 12.5,
          color: "var(--fg-muted, #71717a)",
          lineHeight: 1.55,
        }}
      >
        This will mint a long-lived bearer token. You can revoke it any time
        from your API keys.
      </p>
      {outcome.kind === "error" ? (
        <p
          style={{
            marginTop: 14,
            fontSize: 13,
            color: "var(--accent-600, #b91c1c)",
          }}
        >
          {outcome.message}
        </p>
      ) : null}
    </>
  );
}

function ResultState({ heading, body }: { heading: string; body: string }) {
  return (
    <div style={{ marginTop: 32, textAlign: "center" }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          marginBottom: 12,
        }}
      >
        {heading}
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--fg-muted, #52525b)",
          lineHeight: 1.6,
          marginBottom: 18,
        }}
      >
        {body}
      </p>
      <p style={{ fontSize: 13, color: "var(--fg-muted, #71717a)" }}>
        You can close this tab.
      </p>
      <div style={{ marginTop: 22 }}>
        <Link href="/dashboard" className="mk-btn mk-btn--secondary mk-btn--sm">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
