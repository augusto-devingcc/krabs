import { getDashboardContext } from "../../../../src/lib/web/dashboard-ctx.js";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await getDashboardContext();

  return (
    <div className="p-8 max-w-4xl">
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-2"># billing</p>
      <h1 className="text-3xl font-medium mb-2">Pick your plan</h1>
      <p className="text-[var(--color-fg-muted)] mb-8 max-w-2xl">
        You&apos;re currently on the <strong className="text-[var(--color-fg)]">Free</strong>{" "}
        plan. Pay only when you actually use socrm in production.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Plan
          name="Free"
          price="$0"
          period=""
          current
          features={[
            "1 API key",
            "100 contacts",
            "Full agent contract",
            "Audit log + undo",
            "Community support",
          ]}
        />
        <Plan
          name="Solo"
          price="$9"
          period="/mo"
          highlight
          features={[
            "Unlimited API keys",
            "10,000 contacts",
            "Email ingest, vCard ingest",
            "Account export (JSON)",
            "Email support",
          ]}
          cta="Upgrade to Solo"
          ctaHref={`mailto:support@socrm.dev?subject=Upgrade%20to%20Solo`}
        />
        <Plan
          name="Pro"
          price="$29"
          period="/mo"
          features={[
            "100,000 contacts",
            "Priority email support",
            "Higher rate limits",
            "All future features",
          ]}
          cta="Upgrade to Pro"
          ctaHref={`mailto:support@socrm.dev?subject=Upgrade%20to%20Pro`}
        />
      </div>

      <p className="text-xs text-[var(--color-fg-faint)] mt-6">
        Billing is processed by Polar (Merchant of Record). Cancel anytime.
      </p>
    </div>
  );
}

function Plan({
  name,
  price,
  period,
  features,
  current,
  highlight,
  cta,
  ctaHref,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  current?: boolean;
  highlight?: boolean;
  cta?: string;
  ctaHref?: string;
}) {
  const borderClass = highlight
    ? "border-[var(--color-accent)]"
    : "border-[var(--color-border)]";
  return (
    <div
      className={`bg-[var(--color-surface)] border ${borderClass} rounded-[var(--radius-md)] p-6 flex flex-col`}
    >
      <p className="font-mono text-sm text-[var(--color-fg-muted)] mb-1">{name}</p>
      <p className="mb-4">
        <span className="text-3xl font-medium">{price}</span>
        <span className="text-sm text-[var(--color-fg-muted)]">{period}</span>
      </p>
      <ul className="space-y-1.5 text-sm flex-1 mb-5">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-[var(--color-accent)] font-mono">›</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {current ? (
        <span className="text-center text-sm text-[var(--color-fg-muted)] py-2 border border-[var(--color-border)] rounded-[var(--radius-sm)]">
          current plan
        </span>
      ) : (
        <a
          href={ctaHref ?? "#"}
          className={`text-center text-sm font-medium py-2 rounded-[var(--radius-sm)] ${
            highlight
              ? "bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)]"
              : "border border-[var(--color-border-strong)] hover:border-[var(--color-fg-muted)]"
          }`}
        >
          {cta}
        </a>
      )}
    </div>
  );
}
