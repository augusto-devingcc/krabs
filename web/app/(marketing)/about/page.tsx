import Link from "next/link";

import { BRAND } from "@/lib/brand.js";

export const metadata = {
  title: `About — ${BRAND.productName}`,
  description: `The operator behind ${BRAND.productName}.`,
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <BioSection />
      <ContactBlock />
      <FooterCTA />
    </>
  );
}

function Header() {
  return (
    <section
      style={{
        padding: "80px 32px 48px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div className="mk-eyebrow">founder</div>
      <h1
        className="mk-h2"
        style={{ fontSize: 44, lineHeight: 1.1, maxWidth: 760 }}
      >
        Built by one operator, for one operator.
      </h1>
      <p className="mk-sub" style={{ maxWidth: 640 }}>
        {BRAND.productName} is a side project by Augusto García Graell — built
        because the finance backend I needed to run my own business with agents
        did not exist.
      </p>
    </section>
  );
}

function BioSection() {
  return (
    <section
      style={{
        padding: "32px 32px 80px",
        maxWidth: 1100,
        margin: "0 auto",
        borderTop: "1px solid var(--border-light)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)",
          gap: 48,
          paddingTop: 48,
          alignItems: "start",
        }}
      >
        <div style={{ position: "sticky", top: 100 }}>
          <div
            aria-hidden
            style={{
              width: 200,
              height: 200,
              background: "var(--bg-muted)",
              borderRadius: "var(--radius-4)",
              border: "1px solid var(--border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 56,
              fontWeight: 500,
              color: "var(--fg-2)",
              letterSpacing: "-0.02em",
            }}
          >
            AG
          </div>
          <div
            className="k-mono"
            style={{
              marginTop: 14,
              color: "var(--fg-3)",
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--accent-500)" }}>●</span>
              panama, gmt-5
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <Block heading="who">
            <p>
              Augusto Aaron García Graell. Based in Panama. I run Realtia Labs,
              a real-estate-tech company, and most of its day-to-day operations
              go through AI agents I wrote myself.
            </p>
            <p>
              That experience — running a real business with agents as the
              primary operators — is what led to {BRAND.productName}.
            </p>
          </Block>

          <Block heading="why krabs">
            <p>
              I run my own business with agents. Every finance tool I tried
              assumed the operator was a human clicking through pages — so I kept
              writing adapters to make them agent-shaped.
            </p>
            <p>
              {BRAND.name} is the substrate I needed: one contract, three
              transports, every mutation reversible and audited. I figured I
              would make it available.
            </p>
          </Block>

          <Block heading="what's next">
            <p>
              Building {BRAND.productName} solo. v1 contract is the API; v0.x
              is iterating on transports, idempotency and the audit log.
            </p>
            <p>
              No roadmap deck. Ship, dogfood at Realtia, repeat.
            </p>
          </Block>
        </div>
      </div>
    </section>
  );
}

function Block({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        className="k-h4"
        style={{
          margin: "0 0 12px",
          color: "var(--fg)",
          textTransform: "lowercase",
        }}
      >
        {heading}
      </h2>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          color: "var(--fg-2)",
          fontSize: 15,
          lineHeight: 1.6,
          maxWidth: 620,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ContactBlock() {
  const rows: Array<[string, string]> = [
    ["email", BRAND.email.support],
    ["telegram", "@augustogarciag"],
    ["company", "realtialabs.com"],
  ];

  return (
    <section
      style={{
        padding: "0 32px 80px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          background: "var(--bg-muted)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-4)",
          padding: 28,
        }}
      >
        <div className="mk-eyebrow" style={{ marginBottom: 16 }}>
          contact
        </div>
        <div
          className="k-mono"
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            rowGap: 10,
            columnGap: 24,
            fontSize: 13,
          }}
        >
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <div style={{ color: "var(--fg-3)" }}>{k}</div>
              <div style={{ color: "var(--fg)" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterCTA() {
  return (
    <section
      style={{
        padding: "0 32px 96px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <p
        className="k-body-sm"
        style={{
          color: "var(--fg-3)",
          margin: 0,
        }}
      >
        Want to build with {BRAND.name}?{" "}
        <Link
          href={`mailto:${BRAND.email.support}`}
          style={{
            color: "var(--fg)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            textDecorationColor: "var(--border-light)",
          }}
        >
          {BRAND.email.support}
        </Link>
        <span style={{ marginLeft: 6, color: "var(--fg-3)" }}>→</span>
      </p>
    </section>
  );
}
