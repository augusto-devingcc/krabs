import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "homebrew", label: "Homebrew" },
  { id: "npm", label: "npm" },
  { id: "pnpm-dlx", label: "pnpm dlx" },
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
            The <code>{BRAND.name}</code> CLI is a single binary distributed through Homebrew and
            npm. Pick whichever you already use.
          </p>

          <h2 className="dc__h2" id="homebrew">
            Homebrew
          </h2>
          <p>
            Recommended on macOS and Linux. The command below auto-registers the{" "}
            <code>augusto-devingcc/krabs</code> tap — there is no separate <code>brew tap</code> step.
          </p>
          <pre className="dc__code">{`brew install augusto-devingcc/krabs/krabs`}</pre>
          <p>
            Verify the install resolved correctly:
          </p>
          <pre className="dc__code">{`krabs --version`}</pre>
          <p>
            Updates ride along with <code>brew upgrade</code>. The formula pins to a specific npm
            tarball, so a release is a no-op until the tap repo merges a new version.
          </p>

          <Callout tone="info" title="tap source">
            The formula lives at{" "}
            <a href="https://github.com/augusto-devingcc/homebrew-krabs" target="_blank" rel="noopener noreferrer">
              augusto-devingcc/homebrew-krabs
            </a>
            . The first <code>brew install</code> clones it into your Homebrew taps directory; later
            installs reuse the cached tap.
          </Callout>

          <h2 className="dc__h2" id="npm">
            npm
          </h2>
          <p>
            Cross-platform. Recommended if you do not use Homebrew, or you want the CLI in the same
            Node toolchain as the rest of your project.
          </p>
          <pre className="dc__code">{`npm install -g krabs-cli`}</pre>
          <p>
            Verify the binary is on your <code>PATH</code>:
          </p>
          <pre className="dc__code">{`which krabs`}</pre>
          <p>
            If <code>which</code> returns nothing, your npm global <code>bin</code> directory is not
            on <code>PATH</code>. Run <code>npm config get prefix</code> and add{" "}
            <code>$(npm config get prefix)/bin</code> to your shell rc file.
          </p>

          <h2 className="dc__h2" id="pnpm-dlx">
            pnpm dlx
          </h2>
          <p>
            For one-off use, run the CLI without installing it globally. <code>pnpm dlx</code>{" "}
            fetches the package into a temporary cache, executes it, and discards it.
          </p>
          <pre className="dc__code">{`pnpm dlx krabs-cli auth login`}</pre>
          <p>
            Useful in CI runners or one-shot scripts where leaving a global binary behind is
            undesirable. The equivalent on npm is <code>npx krabs-cli ...</code>.
          </p>

          <h2 className="dc__h2" id="uninstall">
            Uninstall
          </h2>
          <p>
            Remove the binary:
          </p>
          <pre className="dc__code">{`# Homebrew
brew uninstall krabs

# npm
npm uninstall -g krabs-cli`}</pre>
          <p>
            Then wipe the token and config directory:
          </p>
          <pre className="dc__code">{`rm -rf ~/.config/krabs/`}</pre>
          <p>
            Tokens live only on disk here — the server has no record of which machine holds a key,
            only that it exists. If you want to revoke server-side as well, run{" "}
            <code>krabs auth tokens revoke</code> before uninstalling, or use the{" "}
            <Link href="/dashboard/keys">dashboard</Link>.
          </p>

          <h2 className="dc__h2" id="next-steps">
            Next steps
          </h2>
          <ul>
            <li>
              <Link href="/docs/quickstart">Quickstart →</Link> log in, mint a key, run your first
              call.
            </li>
            <li>
              <Link href="/docs/auth">Auth & tokens →</Link> scopes, rotation, and revocation.
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
