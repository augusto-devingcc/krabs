import { BRAND } from "@/lib/brand.js";

export default function SecurityPage() {
  return (
    <main style={{ padding: "80px 32px 120px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="mk-eyebrow">security</div>
        <h1 className="mk-h2" style={{ fontSize: 40, marginTop: 8 }}>
          How {BRAND.name} protects your data.
        </h1>
        <p className="mk-sub" style={{ marginTop: 12 }}>
          We treat the audit log as the API. Every action is signed, logged, and
          reversible.
        </p>

        <div
          style={{
            marginTop: 48,
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          <Section
            title="Data in transit"
            body="TLS 1.3 everywhere. HSTS preloaded across every subdomain. Bearer tokens are stripped from request logs before they hit disk."
          />

          <Section
            title="Data at rest"
            body="Storage is a local SQLite file via libSQL, on your own machine. There is no shared infrastructure and no other tenants — your data never leaves your box."
          />

          <Section
            title="Authentication"
            body="There is no login. Agents authenticate with bearer API keys minted by pnpm setup or krabs key create. Keys are shown once at creation and stored hashed at rest — if you lose one, you rotate, you don't recover."
          />

          <Section title="Audit log">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Every mutation lands in an append-only log keyed by account. Each
              entry carries:
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
                <code className="k-mono">request_id</code> — the originating
                call
              </BulletItem>
              <BulletItem>
                <code className="k-mono">agent_id</code> — when an agent made
                the call
              </BulletItem>
              <BulletItem>
                <code className="k-mono">idempotency_key</code> — to collapse
                retries
              </BulletItem>
              <BulletItem>
                <code className="k-mono">undo_token</code> — for destructive
                ops
              </BulletItem>
            </ul>
          </Section>

          <Section title="Reporting a vulnerability">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Email{" "}
              <a
                href={`mailto:${BRAND.email.security}`}
                style={{ color: "var(--accent-500)" }}
              >
                {BRAND.email.security}
              </a>
              . PGP key available on request. We acknowledge inbound reports
              within 24 hours and aim to ship a fix or mitigation within seven
              days for high-severity issues.
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
