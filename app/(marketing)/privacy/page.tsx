import { BRAND } from "@/lib/brand.js";

export default function PrivacyPage() {
  return (
    <main style={{ padding: "80px 32px 120px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="mk-eyebrow">privacy</div>
        <h1 className="mk-h2" style={{ fontSize: 40, marginTop: 8 }}>
          What we collect, what we don&apos;t.
        </h1>
        <p className="mk-sub" style={{ marginTop: 12 }}>
          We collect what&apos;s needed to run the product. Nothing else.
        </p>

        <div
          style={{
            marginTop: 48,
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <Section title="What we collect">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Three categories, all instrumental to running the service:
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "12px 0 0",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: "var(--fg-2)",
              }}
            >
              <BulletItem>
                Account info — email and identity, handled via Clerk
              </BulletItem>
              <BulletItem>
                Usage telemetry — request counts per endpoint, latency,
                error rates
              </BulletItem>
              <BulletItem>
                CRM data — contacts, deals, notes, and anything else you put
                in
              </BulletItem>
            </ul>
          </Section>

          <Section title="What we don't collect">
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
              <BulletItem>Third-party tracking pixels in product</BulletItem>
              <BulletItem>Marketing analytics in the app surface</BulletItem>
              <BulletItem>
                Message bodies for ML training — your data is not training
                data
              </BulletItem>
            </ul>
          </Section>

          <Section
            title="Where it lives"
            body="Your data is stored in Turso (per-tenant SQLite). Compute runs on Vercel infrastructure. Region selection is available on Pro plans."
          />

          <Section title="Sharing">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              We do not sell, share, or rent your data. Sub-processors are
              limited to:
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "12px 0 0",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: "var(--fg-2)",
              }}
            >
              <BulletItem>Clerk — authentication</BulletItem>
              <BulletItem>Turso — storage</BulletItem>
              <BulletItem>Vercel — compute</BulletItem>
              <BulletItem>Polar — billing</BulletItem>
            </ul>
          </Section>

          <Section title="Your rights">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              <code className="k-mono">account.export</code> returns the full
              corpus as portable JSON.{" "}
              <code className="k-mono">account.delete</code> purges everything
              — with a 7-day soft-delete window for recovery, followed by a
              hard delete.
            </p>
          </Section>

          <Section title="Contact">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Privacy requests go to{" "}
              <a
                href={`mailto:${BRAND.email.support}`}
                style={{ color: "var(--accent-500)" }}
              >
                {BRAND.email.support}
              </a>
              . We aim to respond within five business days.
            </p>
          </Section>
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
