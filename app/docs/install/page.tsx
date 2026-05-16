import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";

const TOC = [
  { id: "from-source", label: "From source (v0.4)" },
  { id: "what-you-get", label: "What you get" },
  { id: "coming-soon", label: "Coming in v0.5" },
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
            krabs is in <code>v0.4</code>. For now, install from source — clone the repo and run
            the setup script. Homebrew + npm distribution ship in <code>v0.5</code>.
          </p>

          <h2 className="dc__h2" id="from-source">
            From source (v0.4)
          </h2>
          <p>Three commands and you have an API + CLI on localhost:</p>
          <pre className="dc__code">{`git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
pnpm install
pnpm setup`}</pre>
          <p>
            <code>pnpm setup</code> creates a local SQLite database, mints an API key for you, and
            writes it to <code>~/.config/krabs/config.json</code>. The CLI is now authenticated
            against your localhost instance.
          </p>
          <p>
            Start the API server in another terminal:
          </p>
          <pre className="dc__code">{`pnpm dev:api`}</pre>
          <p>
            Verify everything by listing the contract:
          </p>
          <pre className="dc__code">{`./cli/dist/index.js schema describe
# or after pnpm build:cli, just: krabs schema describe`}</pre>

          <Callout tone="info" title="why source-only at v0.4">
            We ship the CLI as a published npm package + Homebrew tap in <code>v0.5</code>.
            Until then, source install keeps the release surface small while we stabilize the
            contract. The flow above is what the published binary will run anyway.
          </Callout>

          <h2 className="dc__h2" id="what-you-get">
            What you get
          </h2>
          <ul>
            <li>
              <code>./cli/dist/index.js</code> — the krabs CLI, a single ESM file (~66 KB)
            </li>
            <li>
              <code>~/.config/krabs/config.json</code> — your API URL + bearer token
            </li>
            <li>
              <code>./data/krabs.db</code> — local SQLite, your entire krabs state
            </li>
            <li>
              An accounts row + an api_keys row, both visible if you query the DB directly
            </li>
          </ul>
          <p>
            To put the CLI on your <code>PATH</code> as <code>krabs</code>, symlink it:
          </p>
          <pre className="dc__code">{`ln -s "$PWD/cli/dist/index.js" /usr/local/bin/krabs
krabs --version`}</pre>

          <h2 className="dc__h2" id="coming-soon">
            Coming in v0.5
          </h2>
          <p>The distribution paths that will work once the CLI is published:</p>
          <pre className="dc__code">{`# Homebrew
brew install augusto-devingcc/krabs/krabs

# npm
npm install -g krabs-cli

# Run without installing
pnpm dlx krabs-cli auth login`}</pre>
          <p>
            Track the v0.5 milestone on the{" "}
            <a
              href="https://github.com/augusto-devingcc/krabs/milestones"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub milestones page
            </a>
            .
          </p>

          <h2 className="dc__h2" id="uninstall">
            Uninstall
          </h2>
          <p>Delete the repo and wipe the local config + data:</p>
          <pre className="dc__code">{`rm -rf ~/path/to/krabs
rm -rf ~/.config/krabs
# remove the symlink if you created one:
rm -f /usr/local/bin/krabs`}</pre>
          <p>
            Tokens live only on your disk. If you also created keys against the hosted{" "}
            <code>api.krabs.dev</code>, revoke them from the{" "}
            <Link href="/dashboard/keys">dashboard</Link> before uninstalling.
          </p>

          <h2 className="dc__h2" id="next-steps">
            Next steps
          </h2>
          <ul>
            <li>
              <Link href="/docs/quickstart">Quickstart →</Link> first call, three transports.
            </li>
            <li>
              <Link href="/docs/auth">Auth & tokens →</Link> how to mint, rotate, revoke.
            </li>
            <li>
              <Link href="/docs/self-hosting">Self-hosting →</Link> running krabs entirely on your
              own infrastructure (no Clerk, no Turso).
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
            <span style={{ color: "var(--fg-3)" }}>last updated 2026-05-16 · v0.4.3</span>
          </div>
        </article>
      </main>
      <DocsToc items={TOC} />
    </>
  );
}
