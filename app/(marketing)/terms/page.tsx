import { BRAND } from "@/lib/brand.js";

export default function TermsPage() {
  return (
    <main style={{ padding: "80px 32px 120px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="mk-eyebrow">terms</div>
        <h1 className="mk-h2" style={{ fontSize: 40, marginTop: 8 }}>
          Terms of service.
        </h1>
        <p className="mk-sub" style={{ marginTop: 12 }}>
          The simplest version of the contract between you and{" "}
          {BRAND.productName}.
        </p>

        <div
          style={{
            marginTop: 48,
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <Section title="Acceptable use">
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: "var(--fg-2)",
              }}
            >
              <BulletItem>Don&apos;t ship spam.</BulletItem>
              <BulletItem>
                Don&apos;t store credentials of third parties you don&apos;t
                own.
              </BulletItem>
              <BulletItem>Don&apos;t reverse-engineer rate limits.</BulletItem>
            </ul>
          </Section>

          <Section title="Service availability">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Best-effort uptime on free and starter tiers. Pro+ plans carry a
              99.9% monthly SLA with credits for unmet windows. Live status at{" "}
              <a
                href="https://status.krabs.dev"
                style={{ color: "var(--accent-500)" }}
              >
                status.{BRAND.domain}
              </a>
              .
            </p>
          </Section>

          <Section title="Billing">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Plans cycle monthly. Failed payments trigger a 7-day grace
              window, after which the service is paused and data is retained
              for 30 days before deletion. Refunds within 30 days are handled
              case-by-case at our discretion.
            </p>
          </Section>

          <Section
            title="Data ownership"
            body="You own your data. We're a processor — we hold it, move it, and return it on request, but we do not claim it."
          />

          <Section
            title="Termination"
            body="Either party can terminate at any time. Data export remains available for 30 days after termination, after which the account is purged."
          />

          <Section
            title="Disputes"
            body="Governed by Panamanian law. Disputes are handled in the courts of Panama City."
          />

          <Section
            title="Changes"
            body="Material changes get 30-day notice via email to the account contact. Continued use after the notice period constitutes acceptance."
          />
        </div>

        <div
          style={{
            marginTop: 64,
            padding: "16px 20px",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-4)",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
          }}
        >
          <span>Last updated · 2026-05-16</span>
          <span>v0.1</span>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="k-h3" style={{ margin: 0 }}>
        {title}
      </h2>
      <div style={{ marginTop: 12 }}>
        {body ? (
          <p style={{ color: "var(--fg-2)", margin: 0 }}>{body}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{ color: "var(--accent-500)", fontSize: 10 }}>●</span>
      <span>{children}</span>
    </li>
  );
}
