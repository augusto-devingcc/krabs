import { BRAND } from "@/lib/brand.js";

type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
};

type Bullet = { kind: "shipped" | "fixed" | "broke" | "docs" | "chore"; text: string };
type Entry = {
  version: string;
  date: string;
  title: string;
  body: string;
  bullets: Bullet[];
  url: string;
  prerelease: boolean;
};

const REPO = "augusto-devingcc/krabs";

const bulletColor: Record<Bullet["kind"], string> = {
  shipped: "var(--accent-600)",
  fixed: "var(--fg-2)",
  broke: "var(--danger-500)",
  docs: "var(--fg-3)",
  chore: "var(--fg-3)",
};

// Cache GitHub release fetches at the edge for 10 minutes — releases don't
// change often and we don't want to spam the GitHub API or hit rate limits.
export const revalidate = 600;

async function fetchReleases(): Promise<Entry[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases?per_page=20`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: { revalidate: 600 },
    },
  );
  if (!res.ok) return [];
  const releases: GitHubRelease[] = await res.json();
  return releases
    .filter((r) => !r.draft)
    .map((r) => parseRelease(r));
}

const KNOWN_KINDS = new Set<Bullet["kind"]>([
  "shipped",
  "fixed",
  "broke",
  "docs",
  "chore",
]);

function parseRelease(r: GitHubRelease): Entry {
  const body = r.body ?? "";
  const lines = body.split(/\r?\n/);

  const bullets: Bullet[] = [];
  let titleFromBody = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Title: prefer the first non-bullet/non-heading sentence in the body
    if (!titleFromBody && !line.startsWith("-") && !line.startsWith("*") && !line.startsWith("#")) {
      titleFromBody = line.replace(/^\*+|\*+$/g, "").trim();
      continue;
    }

    // Bullets matching "- shipped:" / "* fixed:" / "- broke:" / etc.
    const m = line.match(/^[-*]\s*(\w+)\s*:\s*(.+)$/);
    if (m && m[1] && m[2]) {
      const kind = m[1].toLowerCase() as Bullet["kind"];
      if (KNOWN_KINDS.has(kind)) {
        bullets.push({ kind, text: m[2].trim() });
      }
    }
  }

  return {
    version: r.tag_name,
    date: (r.published_at ?? "").slice(0, 10),
    title: r.name ?? titleFromBody ?? r.tag_name,
    body,
    bullets,
    url: r.html_url,
    prerelease: r.prerelease,
  };
}

export default async function ChangelogPage() {
  const entries = await fetchReleases();

  return (
    <main style={{ padding: "80px 32px 120px", maxWidth: 880, margin: "0 auto" }}>
      <header style={{ marginBottom: 40 }}>
        <div className="mk-eyebrow">changelog</div>
        <h1 className="mk-h2">What changed in {BRAND.name}.</h1>
        <p className="mk-sub">
          Versioned, monospace, no fluff. Synced from{" "}
          <a
            href={`https://github.com/${REPO}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--fg-2)", textDecoration: "underline" }}
          >
            GitHub Releases
          </a>
          .
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {entries.map((entry, idx) => (
            <ReleaseEntry entry={entry} key={entry.version} first={idx === 0} />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "32px 28px",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-4)",
        color: "var(--fg-2)",
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      No releases yet. Follow{" "}
      <a
        href={`https://github.com/${REPO}/releases`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--fg)", textDecoration: "underline" }}
      >
        github.com/{REPO}/releases
      </a>{" "}
      to know when the first one drops.
    </div>
  );
}

function ReleaseEntry({ entry, first }: { entry: Entry; first: boolean }) {
  return (
    <article
      style={{
        paddingTop: first ? 0 : 40,
        paddingBottom: 40,
        borderBottom: "1px solid var(--border-light)",
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
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--fg-2)", textDecoration: "none" }}
        >
          {entry.version}
        </a>
        {entry.prerelease && (
          <>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ color: "var(--warning-600)" }}>pre-release</span>
          </>
        )}
        {entry.date && (
          <>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{entry.date}</span>
          </>
        )}
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

      {entry.bullets.length > 0 ? (
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
      ) : (
        <p
          style={{
            margin: 0,
            color: "var(--fg-2)",
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {entry.body || "No release notes yet."}
        </p>
      )}
    </article>
  );
}
