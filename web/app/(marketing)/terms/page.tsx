import { BRAND } from "@/lib/brand.js";

export default function TermsPage() {
  return (
    <main style={{ padding: "80px 32px 120px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="mk-eyebrow">terms</div>
        <h1 className="mk-h2" style={{ fontSize: 40, marginTop: 8 }}>
          License & terms.
        </h1>
        <p className="mk-sub" style={{ marginTop: 12 }}>
          {BRAND.productName} is free, open-source software you run yourself.
          There is no service contract — just the MIT license.
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
            title="License"
            body="krabs is released under the MIT license. You may use, copy, modify, and distribute it, including commercially, provided the copyright and license notice are kept. The full text ships in the repository's LICENSE file."
          />

          <Section
            title="No warranty"
            body="The software is provided 'as is', without warranty of any kind. You run it on your own infrastructure and are responsible for your own data, backups, and security."
          />

          <Section
            title="No service"
            body="There is no hosted service, no SLA, no billing, and no account to terminate. krabs is software you operate yourself — availability is whatever your own deployment provides."
          />

          <Section
            title="Your data"
            body="Your data lives in a local SQLite file under your control. We never see it, hold it, or process it."
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
