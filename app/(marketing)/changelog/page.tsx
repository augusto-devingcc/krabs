import { BRAND } from "@/lib/brand.js";

type Bullet = { kind: "shipped" | "fixed" | "broke"; text: string };
type Entry = {
  version: string;
  date: string;
  title: string;
  bullets: Bullet[];
};

const ENTRIES: Entry[] = [
  {
    version: "v0.4.3",
    date: "2026-05-12",
    title: "Idempotency keys now persist 30 days.",
    bullets: [
      { kind: "shipped", text: "Idempotency-Key header honored on all 32 mutation endpoints" },
      { kind: "shipped", text: "30-day window keyed by (account_id, key) tuple" },
      { kind: "fixed", text: "dry-run plans no longer leaked into the audit log" },
    ],
  },
  {
    version: "v0.4.2",
    date: "2026-04-28",
    title: "Undo tokens get a longer leash.",
    bullets: [
      { kind: "shipped", text: "undo window extended from 24h to 72h on deal.delete and contact.delete" },
      { kind: "shipped", text: "undo.list returns expiring tokens, sorted by time-to-live" },
      { kind: "broke", text: "removed undefined behavior of double-undo (now returns 409, was 200)" },
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-04-09",
    title: "MCP transport hits parity with HTTP.",
    bullets: [
      { kind: "shipped", text: "all 46 v1 operations exposed as MCP tools via @krabs/mcp@0.4" },
      { kind: "shipped", text: "tool descriptions sourced from /v1/schema — single source of truth" },
      { kind: "fixed", text: "task.assign over MCP no longer dropped due dates in non-UTC zones" },
      { kind: "fixed", text: "note.create truncating bodies > 8 KiB instead of returning 413" },
    ],
  },
  {
    version: "v0.3.7",
    date: "2026-03-22",
    title: "Audit log gains structured diffs.",
    bullets: [
      { kind: "shipped", text: "audit.list now returns RFC 6902 JSON Patch deltas per mutation" },
      { kind: "shipped", text: "prompt provenance stored alongside MCP-originated writes" },
      { kind: "broke", text: "audit row schema changed: `payload` renamed to `after`, added `before` and `patch`" },
    ],
  },
  {
    version: "v0.3.4",
    date: "2026-02-14",
    title: "CLI release channel goes public.",
    bullets: [
      { kind: "shipped", text: "brew install krabs and curl -sSf releases.krabs.dev/install.sh" },
      { kind: "shipped", text: "krabs login flow with device-code OAuth, no copy-pasted tokens" },
      { kind: "fixed", text: "contact.merge swallowing the loser's tags instead of unioning them" },
    ],
  },
];

const bulletColor: Record<Bullet["kind"], string> = {
  shipped: "var(--accent-600, #E04A1F)",
  fixed: "var(--fg-2)",
  broke: "var(--danger-500, #DC2626)",
};

export default function ChangelogPage() {
  return (
    <main style={{ padding: "80px 32px 120px", maxWidth: 880, margin: "0 auto" }}>
      <header style={{ marginBottom: 56 }}>
        <div className="mk-eyebrow">changelog</div>
        <h1 className="mk-h2">What changed in {BRAND.name}.</h1>
        <p className="mk-sub">Versioned, monospace, no fluff.</p>
      </header>

      <div>
        {ENTRIES.map((entry, idx) => (
          <article
            key={entry.version}
            style={{
              paddingTop: idx === 0 ? 0 : 40,
              paddingBottom: 40,
              borderBottom: `1px solid var(--border-light)`,
            }}
          >
            <div
              className="k-mono"
              style={{
                color: "var(--fg-3)",
                fontSize: 12.5,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ color: "var(--fg-2)" }}>{entry.version}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{entry.date}</span>
            </div>

            <h2
              className="k-h3"
              style={{
                margin: "0 0 18px",
                color: "var(--fg)",
                fontSize: 20,
                lineHeight: 1.35,
                letterSpacing: "-0.01em",
              }}
            >
              {entry.title}
            </h2>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {entry.bullets.map((b, i) => (
                <li
                  key={i}
                  className="k-mono"
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--fg-2)",
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      color: bulletColor[b.kind],
                      fontWeight: 500,
                      minWidth: 64,
                      flexShrink: 0,
                    }}
                  >
                    {b.kind}:
                  </span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
