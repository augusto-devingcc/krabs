import { BRAND } from "@/lib/brand.js";

export default function PrivacyPage() {
  return (
    <main style={{ padding: "80px 32px 120px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="mk-eyebrow">privacy</div>
        <h1 className="mk-h2" style={{ fontSize: 40, marginTop: 8 }}>
          We don&apos;t collect anything.
        </h1>
        <p className="mk-sub" style={{ marginTop: 12 }}>
          krabs is self-hosted and open source. It runs on your own box, with no
          login and no telemetry. Your data never leaves your machine.
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
            title="Where it lives"
            body="On your machine. krabs stores everything in a local SQLite file you control. There are no per-tenant databases, no hosted compute, and no region selection — because there is no hosted version."
          />

          <Section title="What we collect">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Nothing. The software ships with no analytics, no telemetry, and no
              phone-home. This site is a static marketing page with no tracking
              pixels.
            </p>
          </Section>

          <Section title="Sharing">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              There are no sub-processors and nothing to share — krabs has no
              servers that hold your data.
            </p>
          </Section>

          <Section title="Your data">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              It is a file on your disk. Back it up by copying{" "}
              <code className="k-mono">./data/krabs.db</code>; delete it by
              removing the file. No export tickets, no support requests.
            </p>
          </Section>

          <Section title="Contact">
            <p style={{ color: "var(--fg-2)", margin: 0 }}>
              Questions go to{" "}
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
