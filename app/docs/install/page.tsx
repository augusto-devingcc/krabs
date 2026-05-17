import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";

const TOC = [
  { id: "from-source", label: "From source" },
  { id: "what-you-get", label: "What you get" },
  { id: "put-on-path", label: "Put the CLI on PATH" },
  { id: "homebrew-npm", label: "Homebrew · npm" },
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
            krabs ships <code>v0.5.x</code> from source. Clone the repo, run setup, and you have a
            local API + CLI bound to a SQLite file in five minutes. Homebrew + npm distribution is
            wired but not yet published — see below.
          </p>

          <h2 className="dc__h2" id="from-source">
            From source
          </h2>
          <p>Four commands and you have an API + CLI on localhost:</p>
          <pre className="dc__code">{`git clone https://github.com/augusto-devingcc/krabs.git
cd krabs
pnpm install
pnpm setup`}</pre>
          <p>
            <code>pnpm setup</code> creates a local SQLite database under <code>./data/</code>,
            runs all migrations, mints an API key for you, and writes it to{" "}
            <code>~/.config/krabs/config.json</code>. The CLI is now authenticated against
            your localhost instance.
          </p>
          <p>Start the API server in another terminal:</p>
          <pre className="dc__code">{`pnpm dev:api`}</pre>
          <p>Verify everything by listing the contract:</p>
          <pre className="dc__code">{`./cli/dist/index.js schema describe
# or after pnpm build:cli, just: krabs schema describe`}</pre>

          <Callout tone="info" title="why source-only today">
            We&apos;ll cut <code>krabs-cli</code> on npm and a Homebrew tap once the contract has been
            stable for a release cycle. Source install is the same flow under the hood and stays
            useful for self-hosters forever — it is not a workaround.
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
              <code>./data/local.db</code> — local SQLite, your entire krabs state
            </li>
            <li>
              An accounts row + an api_keys row, both visible if you query the DB directly
            </li>
          </ul>

          <h2 className="dc__h2" id="put-on-path">
            Put the CLI on PATH
          </h2>
          <p>
            To call the CLI as <code>krabs</code> from anywhere, symlink the built binary into a
            directory on your <code>PATH</code>:
          </p>
          <pre className="dc__code">{`pnpm build:cli
ln -s "$PWD/cli/dist/index.js" /usr/local/bin/krabs
krabs --version`}</pre>

          <h2 className="dc__h2" id="homebrew-npm">
            Homebrew · npm
          </h2>
          <p>
            A Homebrew formula lives at <code>Formula/krabs.rb</code> in the repo and the CLI
            workspace publishes as <code>krabs-cli</code> on npm. Both paths are wired but
            unpublished — once we ship them, these commands work:
          </p>
          <pre className="dc__code">{`# Homebrew (planned)
brew install augusto-devingcc/krabs/krabs

# npm (planned)
npm install -g krabs-cli

# Run without installing (planned)
pnpm dlx krabs-cli auth login`}</pre>
          <p>
            Track readiness on the{" "}
            <a
              href="https://github.com/augusto-devingcc/krabs/milestones"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub milestones
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
            <span style={{ color: "var(--fg-3)" }}>last updated 2026-05-17 · v0.5.0</span>
          </div>
        </article>
      </main>
      <DocsToc items={TOC} />
    </>
  );
}
