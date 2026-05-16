"use client";

import { useState, useTransition } from "react";
import { requestUpgradeAction } from "./actions";

type Plan = "solo" | "pro";

type PlanSpec = {
  id: "free" | Plan;
  name: string;
  price: string;
  features: string[];
  current?: boolean;
  highlight?: boolean;
  cta?: { plan: Plan; label: string; variant: "primary" | "secondary" };
};

export function PricingGrid({ plans }: { plans: PlanSpec[] }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} onMessage={setMessage} />
        ))}
      </div>
      {message && (
        <div
          role="status"
          className="mt-6 bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-fg)] font-mono"
        >
          <span className="text-[var(--color-fg-muted)]">›</span> {message}
        </div>
      )}
    </>
  );
}

function PlanCard({
  plan,
  onMessage,
}: {
  plan: PlanSpec;
  onMessage: (m: string) => void;
}) {
  const isHighlight = !!plan.highlight;
  const borderClass = isHighlight
    ? "border-2 border-[var(--color-fg)]"
    : "border border-[var(--color-border)]";
  const padding = isHighlight ? "p-7" : "p-6";

  return (
    <div
      className={`bg-[var(--color-surface)] ${borderClass} ${padding} rounded-[var(--radius-md)] flex flex-col`}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
        {plan.name}
      </p>
      <p className="mb-5">
        <span className="text-4xl font-medium tabular-nums">{plan.price}</span>
        {plan.id !== "free" && (
          <span className="text-sm text-[var(--color-fg-muted)] ml-1">/mo</span>
        )}
      </p>
      <ul className="space-y-2 text-sm flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-[var(--color-fg-muted)] font-mono">›</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {plan.current ? (
        <span className="text-center text-xs font-mono uppercase tracking-wide text-[var(--color-fg-muted)] py-2.5 border border-[var(--color-border)] rounded-[var(--radius-sm)]">
          current plan
        </span>
      ) : plan.cta ? (
        <UpgradeButton
          plan={plan.cta.plan}
          label={plan.cta.label}
          variant={plan.cta.variant}
          onMessage={onMessage}
        />
      ) : null}
    </div>
  );
}

function UpgradeButton({
  plan,
  label,
  variant,
  onMessage,
}: {
  plan: Plan;
  label: string;
  variant: "primary" | "secondary";
  onMessage: (m: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await requestUpgradeAction(plan);
      onMessage(r.message);
    });
  }

  const cls =
    variant === "primary"
      ? "bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)]"
      : "border border-[var(--color-border-strong)] text-[var(--color-fg)] hover:border-[var(--color-fg)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`w-full text-center text-sm font-medium py-2.5 rounded-[var(--radius-sm)] disabled:opacity-50 ${cls}`}
    >
      {pending ? "requesting…" : label}
    </button>
  );
}
