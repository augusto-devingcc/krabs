import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";

const TOC = [
  { id: "one-liner", label: "One-liner install" },
  { id: "what-it-does", label: "What the script does" },
  { id: "manual", label: "Manual install (no script)" },
  { id: "npx-github", label: "Without cloning — npx github:" },
  { id: "prebuilt-binary", label: "Prebuilt binary (GitHub Releases)" },
  { id: "what-you-get", label: "What you get on disk" },
  { id: "uninstall", label: "Uninstall" },
  { id: "next-steps", label: "Next steps" },
];

export default function InstallPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / install</div>
          <h1 className="dc__h1">Install</h1>
          <p className="dc__lede">
            krabs is open source and self-hostable. You can install it without
            ever touching npm — clone the repo, run the kickoff, or use the
            one-line installer below. Pick whichever you prefer; they all land
            at the same final state.
          </p>

          <h2 className="dc__h2" id="one-liner">
            One-liner install (recommended)
          </h2>
          <pre className="dc__code">{`curl -fsSL https://krabs.dev/install.sh | sh`}</pre>
          <p>
            Requires <code>node ≥ 22</code> and <code>git</code> on your PATH.
            <code>pnpm</code> gets enabled via{" "}
            <a
              href="https://nodejs.org/api/corepack.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              corepack
            </a>{" "}
            if you don&apos;t have it.
          </p>
          <p>
            Override the install directory with{" "}
            <code>KRABS_DIR=/where/to/install</code> (default{" "}
            <code>$HOME/krabs</code>) or the branch with{" "}
            <code>KRABS_BRANCH=...</code>.
          </p>
          <Callout tone="info" title="not on npm — on purpose">
            We deliberately ship krabs without an npm package. The CLI is a
            single 79 KB ESM file that lives in the cloned repo; the installer
            symlinks it onto your PATH. No npm registry account, no Homebrew
            tap, no global state outside <code>~/.config/krabs/config.json</code>.
          </Callout>

          <h2 className="dc__h2" id="what-it-does">
            What the script does
          </h2>
          <ol>
            <li>Checks <code>node ≥ 22</code> and <code>git</code></li>
            <li>Enables <code>pnpm</code> via <code>corepack</code> if missing</li>
            <li>
              <code>git clone</code> into <code>$HOME/krabs</code> (or{" "}
              <code>$KRABS_DIR</code>)
            </li>
            <li>
              <code>pnpm install</code> (production + dev deps)
            </li>
            <li>
              Copies <code>.env.example</code> to <code>.env</code> if missing
            </li>
            <li>
              <code>pnpm kickoff</code> — builds the CLI + MCP server, runs all
              migrations, mints an API key, saves it to{" "}
              <code>~/.config/krabs/config.json</code>, and prints the MCP
              config snippet for Claude Desktop / Cursor
            </li>
            <li>
              Symlinks <code>dist/cli/main.mjs</code> to the first writable
              directory on your PATH (<code>~/.local/bin</code> →{" "}
              <code>/usr/local/bin</code>) as <code>krabs</code>
            </li>
          </ol>

          <h2 className="dc__h2" id="manual">
            Manual install (no script)
          </h2>
          <p>If you&apos;d rather run every step yourself:</p>
          <pre className="dc__code">{`git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
cp .env.example .env
pnpm install
pnpm kickoff           # builds CLI + MCP, mints key, prints MCP config
ln -s "$PWD/dist/cli/main.mjs" /usr/local/bin/krabs   # optional: put 'krabs' on PATH`}</pre>
          <p>Then start the API in another terminal:</p>
          <pre className="dc__code">{`pnpm dev:api`}</pre>

          <h2 className="dc__h2" id="npx-github">
            Without cloning — <code>npx github:</code>
          </h2>
          <p>
            One-shot invocations without any persistent install (slow on first
            run because npx clones + installs each time, but useful for CI or
            scripts):
          </p>
          <pre className="dc__code">{`npx -y github:augusto-devingcc/krabs schema describe
npx -y github:augusto-devingcc/krabs account business-profile get`}</pre>
          <p>
            The root <code>package.json</code> declares{" "}
            <code>bin.krabs = ./dist/cli/main.mjs</code>, so npx finds the binary
            after the clone. This path doesn&apos;t install anything globally — it
            re-clones to a temp dir each invocation.
          </p>

          <h2 className="dc__h2" id="prebuilt-binary">
            Prebuilt binary (GitHub Releases)
          </h2>
          <p>
            Every tagged release attaches a prebuilt <code>krabs.mjs</code> to
            its{" "}
            <a
              href="https://github.com/augusto-devingcc/krabs/releases"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Releases
            </a>{" "}
            page. If you only want the CLI (no dashboard, no MCP server, no
            local DB), grab it directly:
          </p>
          <pre className="dc__code">{`curl -fsSL https://github.com/augusto-devingcc/krabs/releases/latest/download/krabs.mjs \\
  -o /usr/local/bin/krabs
chmod +x /usr/local/bin/krabs
krabs --version`}</pre>
          <p>
            You&apos;ll still need a krabs API to talk to — point the CLI at your
            self-hosted instance with <code>KRABS_API_URL</code> (see the manual
            flow above).
          </p>

          <h2 className="dc__h2" id="what-you-get">
            What you get on disk
          </h2>
          <ul>
            <li>
              <code>~/krabs/</code> — the cloned repo (configurable via{" "}
              <code>$KRABS_DIR</code>)
            </li>
            <li>
              <code>~/krabs/dist/cli/main.mjs</code> — the krabs CLI, a single
              ESM file (~80 KB)
            </li>
            <li>
              <code>~/krabs/dist/mcp/server.mjs</code> — the MCP server (the
              MCP config snippet points at this path)
            </li>
            <li>
              <code>~/.config/krabs/config.json</code> — your API URL + bearer
              token
            </li>
            <li>
              <code>~/krabs/data/local.db</code> — local SQLite, your entire
              krabs state
            </li>
            <li>
              <code>/usr/local/bin/krabs</code> (or{" "}
              <code>~/.local/bin/krabs</code>) — symlink to{" "}
              <code>dist/cli/main.mjs</code> so the CLI is on PATH
            </li>
          </ul>

          <h2 className="dc__h2" id="uninstall">
            Uninstall
          </h2>
          <pre className="dc__code">{`rm -rf ~/krabs
rm -rf ~/.config/krabs
rm -f /usr/local/bin/krabs   # or wherever the installer put it`}</pre>
          <p>
            All state is local. To revoke a key before removing, run{" "}
            <code>krabs key revoke &lt;key_id&gt;</code>.
          </p>

          <h2 className="dc__h2" id="next-steps">
            Next steps
          </h2>
          <ul>
            <li>
              <Link href="/docs/quickstart">Quickstart →</Link> first call,
              three transports.
            </li>
            <li>
              <Link href="/docs/skill">Agent skill →</Link> the document your
              agent reads to bootstrap itself.
            </li>
            <li>
              <Link href="/docs/finance">Finance · ROAS · CAC →</Link> how the
              agent ingests ad spend and reports funnel metrics.
            </li>
            <li>
              <Link href="/docs/self-hosting">Self-hosting →</Link> running
              krabs entirely on your own infrastructure.
            </li>
          </ul>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/install/page.tsx"
              target="_blank"
              rel="noopener noreferrer"
            >
              Edit this page on GitHub →
            </a>
            <span style={{ color: "var(--fg-3)" }}>
              last updated 2026-05-17 · v0.5.0
            </span>
          </div>
        </article>
      </main>
      <DocsToc items={TOC} />
    </>
  );
}
