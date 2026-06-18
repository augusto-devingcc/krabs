import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";

const TOC = [
  { id: "primitives", label: "Primitives" },
  { id: "summary-mrr", label: "Summary · MRR" },
  { id: "funnel", label: "Funnel · ROAS · CAC" },
  { id: "ingest-ad-spend", label: "Ingesting ad spend" },
  { id: "meta-marketing-cli", label: "Meta Ads CLI" },
  { id: "self-host-parity", label: "Open source" },
];

export default function FinanceDocsPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / finance</div>
          <h1 className="dc__h1">Finance reporting</h1>
          <p className="dc__lede">
            Four primitives — <code>product</code>, <code>subscription</code>,{" "}
            <code>invoice</code>, <code>expense</code> — plus four read-only finance views give
            you MRR, ARR, ROAS, CAC, and blended-CAC over any window. Everything is agent-recorded
            and lives in one local SQLite database.
          </p>

          <h2 className="dc__h2" id="primitives">
            Primitives
          </h2>
          <ul>
            <li>
              <code>product</code> — what you sell. Captured once, referenced by subscriptions and
              invoices.
            </li>
            <li>
              <code>subscription</code> — recurring revenue, optionally tied to a counterparty. Stores{" "}
              <code>mrrCents</code> denormalized so <code>SUM(mrrCents) WHERE status IN
              (&apos;active&apos;,&apos;trialing&apos;)</code> is O(1).
            </li>
            <li>
              <code>invoice</code> — a single bill. Tied to a <code>subscription</code> (recurring
              bill) or standalone, with an optional free-text <code>counterparty</code>.
            </li>
            <li>
              <code>expense</code> — money out. Fields: <code>amountCents</code>,{" "}
              <code>category</code> (<code>ads|infra|contractor|software|tax|fees|salary|...</code>),
              <code>vendor</code>, <code>source</code> (<code>manual|stripe|bank|google_ads|meta_ads|...</code>),
              <code>sourceRef</code> (import dedup key).
            </li>
          </ul>

          <h2 className="dc__h2" id="summary-mrr">
            Summary · MRR · ARR
          </h2>
          <pre className="dc__code">{`krabs finance summary --from 2026-05-01T00:00:00Z --to 2026-05-31T23:59:59Z
krabs finance mrr
krabs finance expenses-by-category --from 2026-05-01T00:00:00Z --to 2026-05-31T23:59:59Z`}</pre>
          <p>
            Same three calls over HTTP: <code>GET /v1/finance/summary</code>,{" "}
            <code>GET /v1/finance/mrr</code>, <code>GET /v1/finance/expenses-by-category</code>.
            Over MCP: <code>finance_summary</code>, <code>finance_mrr</code>,{" "}
            <code>finance_expenses_by_category</code>.
          </p>

          <h2 className="dc__h2" id="funnel">
            Funnel · ROAS · CAC
          </h2>
          <p>
            <code>finance.funnel</code> aggregates revenue and ad spend over a window and
            computes:
          </p>
          <ul>
            <li>
              <strong>ROAS</strong> = paid revenue ÷ ad spend (return on ad spend). Null when ad
              spend is zero.
            </li>
            <li>
              <strong>CAC</strong> = ad spend ÷ new customers (customer acquisition cost from
              paid). Null when nothing converted.
            </li>
            <li>
              <strong>Blended-CAC</strong> = total expenses ÷ new customers. Includes infra,
              contractor, software, etc. — the all-in cost per customer.
            </li>
          </ul>
          <pre className="dc__code">{`$ krabs finance funnel --from 2026-05-01T00:00:00Z --to 2026-05-31T23:59:59Z
{
  "period": { "from": "2026-05-01T00:00:00Z", "to": "2026-05-31T23:59:59Z" },
  "revenue":   { "paid_cents": 4821000, "currency": "USD" },
  "ad_spend":  {
    "total_cents": 850000, "currency": "USD",
    "by_source": [
      { "source": "meta_ads",   "total_cents": 620000 },
      { "source": "google_ads", "total_cents": 230000 }
    ]
  },
  "new_customers":      14,
  "roas":               5.67,
  "cac_cents":          60714,
  "blended_cac_cents":  89821
}`}</pre>
          <Callout tone="info" title="how &lsquo;new customers&rsquo; is computed">
            A new customer is a <code>counterparty</code> whose first paid invoice or active
            subscription falls inside the window. If nothing converted in the window, CAC stays
            null.
          </Callout>

          <h2 className="dc__h2" id="ingest-ad-spend">
            Ingesting ad spend
          </h2>
          <p>
            Ad spend lives in the <code>expense</code> table. Two fields decide where it shows up
            in the funnel breakdown:
          </p>
          <ul>
            <li>
              <code>category</code> must be <code>&quot;ads&quot;</code>.
            </li>
            <li>
              <code>source</code> selects the platform: <code>meta_ads</code>,{" "}
              <code>google_ads</code>, <code>tiktok_ads</code>, etc. Use <code>manual</code> for
              one-off entries.
            </li>
          </ul>
          <pre className="dc__code">{`krabs expense create \\
  --amount-cents 4500 \\
  --currency USD \\
  --category ads \\
  --source meta_ads \\
  --source-ref "act_1234567:2026-05-16" \\
  --vendor "Meta Ads · Campaign X" \\
  --occurred-at 2026-05-16T00:00:00Z`}</pre>
          <p>
            <code>sourceRef</code> is the import dedup key. Re-running the ingestion on the same
            day with the same key returns the existing row instead of inserting a duplicate.
            That makes the daily-cron pattern safe.
          </p>

          <h2 className="dc__h2" id="meta-marketing-cli">
            Meta Ads CLI
          </h2>
          <p>
            Meta shipped an{" "}
            <a
              href="https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-cli/ads-cli-overview"
              target="_blank"
              rel="noopener noreferrer"
            >
              official Ads CLI
            </a>{" "}
            on 2026-04-29, designed for AI agents — predictable commands, JSON output, defined
            exit codes. It ships as a Python package (Python 3.12+). krabs does not bundle a
            Meta-specific adapter; instead the agent (or a small daily cron) calls Meta&apos;s CLI,
            pipes the insights through <code>jq</code>, and records each line as a krabs{" "}
            <code>expense</code>.
          </p>
          <pre className="dc__code">{`# 0. Install Meta's official Ads CLI (one-time)
pip install meta-ads-cli
meta --version

# 1. Pull last 7 days of spend per campaign as JSON
meta ads insights get \\
  --date-preset last_7d \\
  --fields spend,impressions,campaign_id,date_start,date_stop \\
  --format json > /tmp/meta.json`}</pre>
          <pre className="dc__code">{`# 2. For each row, record it in krabs (Bash loop, or have your agent do it)
jq -c '.[]' /tmp/meta.json | while read -r row; do
  # Meta returns spend as a decimal-string in account currency — convert to cents
  spend_cents=$(echo "$row" | jq -r '(.spend | tonumber * 100 | floor)')
  campaign=$(echo "$row"    | jq -r '.campaign_id')
  date=$(echo "$row"        | jq -r '.date_start')

  krabs expense create \\
    --amount-cents "$spend_cents" \\
    --currency USD \\
    --category ads \\
    --source meta_ads \\
    --source-ref "${'$'}{campaign}:${'$'}{date}" \\
    --vendor "Meta Ads · ${'$'}{campaign}" \\
    --occurred-at "${'$'}{date}T00:00:00Z"
done`}</pre>
          <p>
            <code>sourceRef</code> = <code>{`${'campaignId'}:${'date'}`}</code> is the dedup key.
            Re-running the same window is safe — krabs returns the existing row on collision
            instead of inserting a duplicate.
          </p>
          <p>
            Same recipe for Google (
            <a
              href="https://github.com/googleads/google-ads-python"
              target="_blank"
              rel="noopener noreferrer"
            >
              google-ads-python
            </a>
            ), TikTok, LinkedIn — change <code>--source</code> to{" "}
            <code>google_ads | tiktok_ads | linkedin_ads</code>. As long as the row lands with{" "}
            <code>category=&quot;ads&quot;</code> and a non-<code>manual</code> source, the funnel
            breakdown lights up automatically.
          </p>

          <h2 className="dc__h2" id="self-host-parity">
            Open source, self-hosted
          </h2>
          <p>
            All finance endpoints, MCP tools, and CLI commands are part of the open-source core.
            You run the single account on your own box — same primitives over MCP, HTTP, and CLI,
            same agent skill. There is no cloud version and no third-party billing integration.
          </p>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/finance/page.tsx"
              target="_blank"
              rel="noopener noreferrer"
            >
              Edit this page on GitHub →
            </a>
            <span style={{ color: "var(--fg-3)" }}>last updated 2026-05-17 · v0.5.0</span>
          </div>
        </article>
      </main>
      <DocsToc items={TOC} />
    </>
  );
}
