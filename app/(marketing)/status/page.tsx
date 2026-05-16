type Service = {
  name: string;
  endpoint: string;
  uptime: string;
};

const SERVICES: Service[] = [
  { name: "MCP server", endpoint: "mcp.krabs.dev", uptime: "99.99%" },
  { name: "HTTP API", endpoint: "api.krabs.dev", uptime: "99.98%" },
  { name: "CLI release channel", endpoint: "releases.krabs.dev", uptime: "100.00%" },
  { name: "Web dashboard", endpoint: "app.krabs.dev", uptime: "99.97%" },
  { name: "Auth (Clerk)", endpoint: "auth.krabs.dev", uptime: "99.99%" },
  { name: "Status page", endpoint: "status.krabs.dev", uptime: "100.00%" },
];

const TODAY_ISO = "2026-05-16";

const METRICS: Array<{ key: string; value: string }> = [
  { key: "p50_latency", value: "18 ms" },
  { key: "p99_latency", value: "64 ms" },
  { key: "requests_per_day", value: "2,431,802" },
  { key: "error_rate_30d", value: "0.012%" },
];

function Pip() {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--success-500)",
        boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.18)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export default function StatusPage() {
  return (
    <main style={{ padding: "80px 32px 120px", maxWidth: 880, margin: "0 auto" }}>
      <header style={{ marginBottom: 48 }}>
        <div className="mk-eyebrow">status</div>
        <h1 className="mk-h2">All systems operational.</h1>
        <p
          className="mk-sub"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            color: "var(--fg-3)",
          }}
        >
          <span>{TODAY_ISO}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span className="k-mono" style={{ fontSize: 13 }}>
            last incident · none in 30 days
          </span>
        </p>
      </header>

      <section
        style={{
          border: `1px solid var(--border-light)`,
          borderRadius: "var(--radius-4)",
          overflow: "hidden",
          marginBottom: 40,
          background: "var(--bg)",
        }}
      >
        {SERVICES.map((svc, i) => (
          <div
            key={svc.endpoint}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 16,
              padding: "18px 20px",
              borderTop: i === 0 ? "none" : `1px solid var(--border-light)`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--fg)",
                  letterSpacing: "-0.005em",
                }}
              >
                {svc.name}
              </div>
              <div
                className="k-mono"
                style={{
                  fontSize: 12.5,
                  color: "var(--fg-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {svc.endpoint}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pip />
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--fg-2)",
                  }}
                >
                  operational
                </span>
              </div>
              <span
                className="k-mono"
                style={{
                  fontSize: 12.5,
                  color: "var(--fg-3)",
                  minWidth: 64,
                  textAlign: "right",
                }}
              >
                {svc.uptime}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="mk-eyebrow" style={{ marginBottom: 12 }}>
          metrics · last 30 days
        </div>
        <div
          style={{
            border: `1px solid var(--border-light)`,
            borderRadius: "var(--radius-4)",
            padding: "20px 24px",
            background: "var(--bg-subtle)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px 32px",
          }}
        >
          {METRICS.map((m) => (
            <div
              key={m.key}
              className="k-mono"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--fg-3)" }}>{m.key}</span>
              <span style={{ color: "var(--fg)", fontSize: 15 }}>{m.value}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
