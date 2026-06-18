import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "intro", label: "Intro" },
  { id: "prerequisites", label: "Prerequisites" },
  { id: "option-a-docker", label: "Option A — Docker" },
  { id: "option-b-node", label: "Option B — Node" },
  { id: "using-the-cli", label: "Using the CLI" },
  { id: "using-the-api", label: "Using the API" },
  { id: "agents", label: "Agents" },
  { id: "limitations", label: "What it is not" },
  { id: "backups", label: "Backups" },
  { id: "upgrading", label: "Upgrading" },
];

export default function SelfHostingPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / self-hosting</div>
          <h1 className="dc__h1">Self-hosting</h1>
          <p className="dc__lede">
            {BRAND.name} is self-host only. You run it on your own box: the HTTP API, the CLI, the
            MCP server, and the audit log — fully under your control. No login, no billing, no web
            dashboard, single account.
          </p>

          <h2 className="dc__h2" id="intro">
            Intro
          </h2>
          <p>
            {BRAND.name} runs the standalone Hono API server (<code>src/api/server.ts</code>), which
            also mounts the MCP server. Everything an agent needs — the contract, the operations,
            the audit log, the CLI, MCP — works against your node.
          </p>

          <Callout tone="info" title="what you get">
            The API contract at <code>/v1/*</code>, the CLI surface, the schema endpoint, the audit
            log, the idempotency keys, and the MCP server at <code>/v1/mcp</code>. There is no web
            dashboard and no login — a {BRAND.name} install is single-account, you authenticate with
            the bootstrap API key that <code>pnpm setup</code> mints.
          </Callout>

          <h2 className="dc__h2" id="prerequisites">
            Prerequisites
          </h2>
          <ul>
            <li>Node 22+ — set in <code>engines.node</code>.</li>
            <li>pnpm 9+ — used to install and to run <code>pnpm setup</code> once.</li>
            <li>Docker — optional, recommended if you do not want to manage Node yourself.</li>
            <li>Disk — about 50 MB for code, plus roughly 1 MB of SQLite per 10k records.</li>
          </ul>

          <h2 className="dc__h2" id="option-a-docker">
            Option A — Docker
          </h2>
          <p>
            The shortest path. Three commands plus one host-side setup step:
          </p>
          <pre className="dc__code">{`git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
cp .env.example .env
pnpm install
DATABASE_URL=file:./data/krabs.db pnpm setup
docker compose up -d`}</pre>
          <p>
            <code>pnpm setup</code> runs on the host against the same SQLite file the container
            will mount (<code>./data/krabs.db</code>). It creates the local account, runs
            migrations, and prints a bootstrap API key. Save the key — you will not see it again.
          </p>
          <p>
            The volume mount in <code>docker-compose.yml</code> binds <code>./data</code> on the
            host to <code>/app/data</code> in the container, so the SQLite file is durable across
            restarts. Backups reduce to copying <code>./data/krabs.db</code>.
          </p>
          <p>
            Port mapping defaults to <code>3000:3000</code>. Override with <code>KRABS_PORT</code>:
          </p>
          <pre className="dc__code">{`KRABS_PORT=8088 docker compose up -d`}</pre>

          <Callout tone="warning" title="run setup on the host, not inside the container">
            <code>pnpm setup</code> is interactive and writes the bootstrap key to your terminal.
            Running it on the host against the volume-mounted SQLite file is simpler than execing
            into the container. The container itself only runs migrations on boot and starts the
            API.
          </Callout>

          <h2 className="dc__h2" id="option-b-node">
            Option B — Node
          </h2>
          <p>
            For developers who already have a Node toolchain. No Docker required.
          </p>
          <pre className="dc__code">{`git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
cp .env.example .env
pnpm install
pnpm setup
pnpm dev:api`}</pre>
          <p>
            <code>pnpm dev:api</code> runs the Hono server under <code>tsx watch</code> on{" "}
            <code>http://localhost:3000</code>. For a production-style run without watch:
          </p>
          <pre className="dc__code">{`node --import tsx src/api/server.ts`}</pre>

          <h2 className="dc__h2" id="using-the-cli">
            Using the CLI
          </h2>
          <p>
            <code>pnpm setup</code> already saved your bootstrap token. Verify with:
          </p>
          <pre className="dc__code">{`krabs auth status`}</pre>
          <p>
            Point the CLI at your local server:
          </p>
          <pre className="dc__code">{`export KRABS_API_URL=http://localhost:3000

# or, persist it in the CLI config:
krabs auth login --token <your-bootstrap-key> --api-url http://localhost:3000`}</pre>

          <h2 className="dc__h2" id="using-the-api">
            Using the API
          </h2>
          <p>
            The API is plain HTTP. Every operation is documented at <code>/v1/schema</code>:
          </p>
          <pre className="dc__code">{`curl http://localhost:3000/v1/schema | jq '.operations[].operation' | head`}</pre>
          <p>
            Pass your bootstrap key as a bearer token on every other route:
          </p>
          <pre className="dc__code">{`curl http://localhost:3000/v1/me \\
  -H "Authorization: Bearer $KRABS_API_KEY"`}</pre>

          <h2 className="dc__h2" id="agents">
            Agents
          </h2>
          <p>
            Drop the agent skill into your Claude config:
          </p>
          <pre className="dc__code">{`mkdir -p ~/.claude/skills/krabs
curl -fsSL https://${BRAND.domain}/skill.md -o ~/.claude/skills/krabs/SKILL.md`}</pre>
          <p>
            The skill is portable: it describes the contract, not the deployment. The same{" "}
            <code>skill.md</code> works against a hosted node and a self-hosted node — point the
            CLI or MCP proxy at whichever URL you run.
          </p>

          <h2 className="dc__h2" id="limitations">
            What it is not
          </h2>
          <p>
            {BRAND.name} ships the API, the CLI, and the MCP server. By design it has no:
          </p>
          <ul>
            <li>Web dashboard — agents operate it; there is no human UI.</li>
            <li>Login or user accounts — single account, authenticate with the bootstrap API key.</li>
            <li>Billing — no plans, no quotas, no metering. It is free and open source (MIT).</li>
            <li>Multi-tenancy — one install, one account, one set of keys.</li>
          </ul>

          <h2 className="dc__h2" id="backups">
            Backups
          </h2>
          <p>
            SQLite makes backups trivial. Use the online <code>.backup</code> command so writers
            do not block:
          </p>
          <pre className="dc__code">{`# one-shot snapshot
sqlite3 ./data/krabs.db ".backup './data/krabs-$(date +%F).db'"

# nightly via cron (2 AM)
0 2 * * * sqlite3 /srv/krabs/data/krabs.db ".backup '/srv/krabs/backups/krabs-$(date +\\%F).db'"`}</pre>
          <p>
            Restore is a file copy. Stop the container, replace <code>./data/krabs.db</code>,
            start it again.
          </p>

          <h2 className="dc__h2" id="upgrading">
            Upgrading
          </h2>
          <p>
            Pull, install, migrate, rebuild:
          </p>
          <pre className="dc__code">{`git pull
pnpm install
pnpm db:migrate
docker compose up -d --build`}</pre>
          <p>
            Migrations are additive-only. There is no automated rollback — to roll back, restore
            the pre-upgrade <code>./data/krabs.db</code> snapshot and check out the previous git
            tag.
          </p>

          <h2 className="dc__h2" id="next-steps">
            Next steps
          </h2>
          <ul>
            <li>
              <Link href="/docs/quickstart">Quickstart →</Link> — same flow, against your own
              server.
            </li>
            <li>
              <Link href="/docs/contract">The contract →</Link> — the five properties every
              operation honors, hosted or self-hosted.
            </li>
          </ul>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/self-hosting/page.tsx"
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
