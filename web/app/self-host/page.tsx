import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand.js";

export default function SelfHostPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 32px",
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <div style={{ maxWidth: 560, width: "100%" }}>
        <Link href="/" style={{ display: "inline-flex", marginBottom: 48 }}>
          <Image
            src="/brand/logo-wordmark.svg"
            alt={BRAND.productName}
            width={110}
            height={22}
            priority
          />
        </Link>

        <div className="mk-eyebrow" style={{ marginBottom: 8 }}>
          self-host
        </div>
        <h1 className="mk-h2">krabs runs on your box.</h1>
        <p className="mk-sub" style={{ marginTop: 12, maxWidth: "100%" }}>
          Self-hosted, open source, no login. Clone the repo and run{" "}
          <code>pnpm setup</code> — you get the HTTP API, the MCP server, and the
          CLI on localhost, single account, your data in SQLite.
        </p>

        <div
          style={{
            marginTop: 40,
            padding: "20px 24px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-4)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <Row label="API" detail={<>Listening on <code>/v1/*</code> — see <Link href="/v1/schema"><code>/v1/schema</code></Link> for the full contract.</>} />
          <Row label="CLI" detail={<>Run <code>krabs --help</code>. The setup script wrote your token to <code>~/.config/krabs/config.json</code>.</>} />
          <Row label="Skill" detail={<>Drop <Link href="/skill.md"><code>/skill.md</code></Link> into your agent so it knows how to operate krabs.</>} />
          <Row label="Docs" detail={<><Link href="/docs/self-hosting">Self-hosting guide</Link> · <Link href="/docs/quickstart">Quickstart</Link> · <Link href="/docs/contract">Contract</Link></>} />
        </div>

        <p className="k-body-sm" style={{ marginTop: 32, color: "var(--fg-3)" }}>
          Source and issues on{" "}
          <Link href={BRAND.repo}>GitHub</Link>. MIT licensed.
        </p>
      </div>
    </main>
  );
}

function Row({ label, detail }: { label: string; detail: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
      <div
        style={{
          minWidth: 60,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.55, color: "var(--fg-2)" }}>
        {detail}
      </div>
    </div>
  );
}
