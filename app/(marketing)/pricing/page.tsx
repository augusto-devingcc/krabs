import Link from "next/link";

import { BRAND } from "@/lib/brand.js";

export const metadata = {
  title: `Pricing — ${BRAND.productName}`,
  description: `${BRAND.productName} pricing. Free tier for side projects, paid tiers for real ones. No per-seat tax, no quote calls.`,
};

type Tier = {
  key: "free" | "pro" | "enterprise";
  name: string;
  price: string;
  cadence: string;
  desc: string;
  features: string[];
  cta: { label: string; href: string };
  ctaVariant: "primary" | "secondary";
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    desc: "Enough for a side project or a single agent.",
    features: [
      "500 ops / month",
      "1,000 contacts",
      "7-day audit retention",
      "24h undo window",
      "MCP, CLI, HTTP",
      "Community support",
    ],
    cta: { label: "Start free", href: "/sign-up" },
    ctaVariant: "secondary",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    cadence: "/ month",
    desc: "For agents shipping production workloads.",
    features: [
      "250,000 ops / month",
      "Unlimited contacts",
      "Webhooks",
      "1-year audit retention",
      "7-day undo window",
      "Priority support",
    ],
    cta: { label: "Start Pro", href: "/sign-up" },
    ctaVariant: "primary",
    featured: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "annual contract",
    desc: "For teams of agents running a business.",
    features: [
      "Unlimited ops",
      "Unlimited contacts",
      "Webhooks",
      "Unlimited audit retention",
      "Configurable undo window",
      "SSO / SAML",
      "Dedicated support",
    ],
    cta: {
      label: "Contact us",
      href: `mailto:${BRAND.email.support}?subject=krabs.dev%20Enterprise`,
    },
    ctaVariant: "secondary",
  },
];

type Row =
  | { label: string; values: [string, string, string]; mono?: boolean }
  | { label: string; values: [boolean, boolean, boolean]; bool: true };

const COMPARE: Row[] = [
  {
    label: "Operations / month",
    values: ["500", "250,000", "unlimited"],
    mono: true,
  },
  {
    label: "Contacts",
    values: ["1,000", "unlimited", "unlimited"],
    mono: true,
  },
  {
    label: "Identities per contact",
    values: ["3", "unlimited", "unlimited"],
    mono: true,
  },
  {
    label: "Webhooks",
    values: [false, true, true],
    bool: true,
  },
  {
    label: "Audit log retention",
    values: ["7 days", "1 year", "unlimited"],
    mono: true,
  },
  {
    label: "Undo window",
    values: ["24h", "7 days", "configurable"],
    mono: true,
  },
  {
    label: "SSO / SAML",
    values: [false, false, true],
    bool: true,
  },
  {
    label: "MCP server access",
    values: [true, true, true],
    bool: true,
  },
  {
    label: "Support level",
    values: ["community", "priority", "dedicated"],
    mono: true,
  },
];

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What's an \"op\"?",
    a: (
      <>
        An op is a single mutation call against the API — anything that writes
        state. Reads, schema introspection and audit queries don&apos;t count.
      </>
    ),
  },
  {
    q: "Do I need a credit card for the free tier?",
    a: <>No. Sign up with email. Add a card only when you upgrade.</>,
  },
  {
    q: "What happens at 501 ops on Free?",
    a: (
      <>
        Mutation calls return <span className="k-mono">rate_limited</span>. Reads
        keep working. No surprise charges, no auto-upgrade — you choose when to
        move up.
      </>
    ),
  },
  {
    q: "Can I downgrade?",
    a: (
      <>
        Yes, anytime. Pro-rated refund within 30 days. Your data stays put; the
        ops ceiling drops at the next cycle.
      </>
    ),
  },
  {
    q: "Is self-hosting free?",
    a: (
      <>
        Yes. {BRAND.productName} is MIT-licensed — clone the repo, run it on
        your own box, pay nothing. Hosted is the paid product.
      </>
    ),
  },
  {
    q: "Annual discount?",
    a: <>Coming in v0.5 — two months free on annual plans.</>,
  },
];

export default function PricingPage() {
  return (
    <>
      <PricingHeader />
      <TierGrid />
      <CompareTable />
      <UsageSection />
      <FAQSection />
      <ClosingCTA />
    </>
  );
}

function PricingHeader() {
  return (
    <section
      style={{
        padding: "80px 32px 48px",
        maxWidth: 1100,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div className="mk-eyebrow">pricing</div>
      <h1
        className="k-display"
        style={{
          fontSize: 56,
          lineHeight: 1.05,
          letterSpacing: "-0.022em",
          margin: "10px auto 16px",
          maxWidth: 820,
          color: "var(--fg)",
        }}
      >
        Priced for one operator, not one seat.
      </h1>
      <p
        className="mk-sub"
        style={{ margin: "0 auto", maxWidth: 620, color: "var(--fg-3)" }}
      >
        No per-seat tax, no quote calls. Free tier is enough for a side
        project. Paid tiers are enough for a real one.
      </p>
    </section>
  );
}

function TierGrid() {
  return (
    <section
      style={{
        padding: "32px 32px 32px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div className="pricing-grid">
        {TIERS.map((t) => (
          <TierCard tier={t} key={t.key} />
        ))}
      </div>
    </section>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const cardStyle: React.CSSProperties = {
    position: "relative",
    background: "var(--bg)",
    border: `1px solid ${tier.featured ? "var(--border-strong)" : "var(--border-light)"}`,
    borderRadius: "var(--radius-5)",
    padding: 30,
    display: "flex",
    flexDirection: "column",
    gap: 20,
    ...(tier.featured ? { boxShadow: "var(--shadow-2)" } : {}),
  };

  return (
    <div style={cardStyle}>
      {tier.featured ? (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 24,
            background: "var(--accent-500)",
            color: "#fff",
            fontSize: 10,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "var(--radius-2)",
          }}
        >
          Most popular
        </div>
      ) : null}

      <div className="mk-eyebrow" style={{ fontFamily: "var(--font-mono)" }}>
        {tier.name}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "-0.022em",
            lineHeight: 1,
            color: "var(--fg)",
          }}
        >
          {tier.price}
        </span>
        <span className="k-mono" style={{ color: "var(--fg-3)", fontSize: 13 }}>
          {tier.cadence}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--fg-2)",
          lineHeight: 1.5,
        }}
      >
        {tier.desc}
      </p>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        {tier.features.map((f) => (
          <li
            key={f}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              fontSize: 13.5,
              color: "var(--fg-2)",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                color: "var(--accent-500)",
                fontSize: 9,
                lineHeight: 1,
              }}
            >
              ●
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={tier.cta.href}
        className={`mk-btn mk-btn--${tier.ctaVariant} mk-btn--lg`}
        style={{ width: "100%" }}
      >
        {tier.cta.label}
      </Link>
    </div>
  );
}

function CompareTable() {
  const headers = ["Free", "Pro", "Enterprise"];

  return (
    <section
      style={{
        padding: "64px 32px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div className="mk-eyebrow" style={{ marginBottom: 8 }}>
        compare
      </div>
      <h2 className="mk-h2" style={{ marginTop: 0 }}>
        Every tier, side by side.
      </h2>

      <div
        style={{
          marginTop: 32,
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-4)",
          overflow: "hidden",
        }}
        className="pricing-compare"
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13.5,
          }}
        >
          <thead>
            <tr style={{ background: "var(--bg-subtle)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "14px 18px",
                  fontWeight: 500,
                  color: "var(--fg-3)",
                  fontSize: 11,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                Feature
              </th>
              {headers.map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "14px 18px",
                    fontWeight: 500,
                    color: "var(--fg)",
                    fontSize: 11,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((row, i) => (
              <tr
                key={row.label}
                style={{
                  borderTop:
                    i === 0 ? "none" : "1px solid var(--border-light)",
                }}
              >
                <td
                  style={{
                    padding: "12px 18px",
                    color: "var(--fg-2)",
                  }}
                >
                  {row.label}
                </td>
                {"bool" in row
                  ? row.values.map((v, idx) => (
                      <td
                        key={idx}
                        style={{
                          padding: "12px 18px",
                          color: v ? "var(--fg)" : "var(--fg-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {v ? "●" : "—"}
                      </td>
                    ))
                  : row.values.map((v, idx) => (
                      <td
                        key={idx}
                        style={{
                          padding: "12px 18px",
                          color: "var(--fg)",
                          fontFamily: row.mono
                            ? "var(--font-mono)"
                            : "var(--font-sans)",
                        }}
                      >
                        {v}
                      </td>
                    ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsageSection() {
  return (
    <section
      style={{
        padding: "64px 32px",
        maxWidth: 1100,
        margin: "0 auto",
        borderTop: "1px solid var(--border-light)",
      }}
    >
      <div className="mk-eyebrow">usage</div>
      <h2 className="mk-h2">An &quot;op&quot; is a single mutation call.</h2>
      <p className="mk-sub" style={{ maxWidth: 640 }}>
        Reads are free. Audit log entries don&apos;t count. Dry-run plans
        don&apos;t count. Every <span className="k-mono">contact.create</span>,
        {" "}
        <span className="k-mono">deal.update</span>,{" "}
        <span className="k-mono">undo</span>, etc. counts as one op.
      </p>

      <pre
        style={{
          marginTop: 28,
          padding: "18px 20px",
          background: "var(--neutral-950)",
          color: "#fafafa",
          borderRadius: "var(--radius-4)",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          lineHeight: 1.7,
          overflowX: "auto",
        }}
      >
        <span style={{ color: "#71717a" }}>{"# deal lifecycle — 5 ops total\n"}</span>
        {"krabs contact.upsert   "}<span style={{ color: "#86efac" }}>→ 1 op</span>{"\n"}
        {"krabs deal.create      "}<span style={{ color: "#86efac" }}>→ 1 op</span>{"\n"}
        {"krabs deal.update      "}<span style={{ color: "#86efac" }}>→ 1 op</span>{"\n"}
        {"krabs note.create      "}<span style={{ color: "#86efac" }}>→ 1 op</span>{"\n"}
        {"krabs deal.update      "}<span style={{ color: "#86efac" }}>→ 1 op</span>{"\n"}
        {"krabs deal.get         "}<span style={{ color: "#71717a" }}>→ 0 ops (read)</span>
      </pre>
    </section>
  );
}

function FAQSection() {
  return (
    <section
      style={{
        padding: "64px 32px",
        maxWidth: 880,
        margin: "0 auto",
        borderTop: "1px solid var(--border-light)",
      }}
    >
      <div className="mk-eyebrow">frequently asked</div>
      <h2 className="mk-h2">Pricing FAQ</h2>

      <div
        style={{
          marginTop: 24,
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-4)",
          overflow: "hidden",
        }}
      >
        {FAQS.map((f, i) => (
          <details
            key={f.q}
            style={{
              borderTop: i === 0 ? "none" : "1px solid var(--border-light)",
              padding: "16px 20px",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--fg)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>{f.q}</span>
              <span
                style={{
                  color: "var(--fg-3)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              >
                ▾
              </span>
            </summary>
            <div
              style={{
                marginTop: 10,
                color: "var(--fg-2)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {f.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section
      style={{
        padding: "80px 32px 120px",
        maxWidth: 1100,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h2
        className="mk-h2"
        style={{ maxWidth: 720, margin: "0 auto 24px" }}
      >
        Start with Free. Upgrade only when your agents are doing real work.
      </h2>
      <div
        style={{
          display: "inline-flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link href="/sign-up" className="mk-btn mk-btn--primary mk-btn--lg">
          Start free
        </Link>
        <Link href="/docs" className="mk-btn mk-btn--secondary mk-btn--lg">
          Read the docs <span style={{ marginLeft: 4 }}>→</span>
        </Link>
      </div>
    </section>
  );
}
