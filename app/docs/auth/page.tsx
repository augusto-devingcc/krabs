import Link from "next/link";
import { DocsToc } from "@/components/docs/DocsToc";
import { Callout } from "@/components/docs/Callout";
import { BRAND } from "@/lib/brand.js";

const TOC = [
  { id: "token-format", label: "Token format" },
  { id: "minting-keys", label: "Minting keys" },
  { id: "scopes", label: "Scopes" },
  { id: "using-the-token", label: "Using the token" },
  { id: "rotation", label: "Rotation" },
  { id: "revocation", label: "Revocation" },
  { id: "errors", label: "Errors" },
];

export default function AuthPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / auth</div>
          <h1 className="dc__h1">Auth & tokens</h1>
          <p className="dc__lede">
            Every call {BRAND.name} sees must carry a bearer token. Tokens are scoped, rotatable,
            and never logged.
          </p>

          <h2 className="dc__h2" id="token-format">
            Token format
          </h2>
          <p>
            Tokens follow the shape <code>krabs_sk_&lt;base32&gt;</code>. The body after the prefix
            is exactly 40 characters of Crockford base32 entropy.
          </p>
          <pre className="dc__code">{`krabs_sk_4n7q2vh3jpz9w8x1y0c5b6d4f8g2k1m3`}</pre>
          <p>
            Tokens are shown <strong>once</strong> at creation. We store an Argon2id hash; the
            plaintext never touches the database, the logs, or any error report.
          </p>

          <Callout tone="warning" title="shown once">
            If you close the modal without copying the token, you cannot recover it. Rotate the key
            to issue a new one — the lost token is dead weight, not a security risk.
          </Callout>

          <h2 className="dc__h2" id="minting-keys">
            Minting keys
          </h2>
          <p>
            From the web dashboard at <Link href="/dashboard/keys"><code>/dashboard/keys</code></Link>,
            or via CLI:
          </p>
          <pre className="dc__code">{`krabs auth tokens create --label "my agent"`}</pre>
          <p>
            Output:
          </p>
          <pre className="dc__code">{`key_id: key_01HGZ9X4QY8M2N7P3R5T6V8W
label:  my agent
scope:  full
token:  krabs_sk_4n7q2vh3jpz9w8x1y0c5b6d4f8g2k1m3
        ↑ copy now, you will not see this again`}</pre>

          <h2 className="dc__h2" id="scopes">
            Scopes
          </h2>
          <p>
            A token carries exactly one scope. Granular per-resource scopes ship in v0.5.
          </p>
          <table className="dc__table">
            <thead>
              <tr>
                <th>scope</th>
                <th>description</th>
                <th>default</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>full</code></td>
                <td>read and write across every namespace</td>
                <td>✓</td>
              </tr>
              <tr>
                <td><code>read</code></td>
                <td>read across every namespace, no mutations</td>
                <td></td>
              </tr>
              <tr>
                <td><code>write</code></td>
                <td>read and write, blocks <code>account.*</code> and key management</td>
                <td></td>
              </tr>
              <tr>
                <td><code>audit-read</code></td>
                <td>read access limited to the append-only audit log</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <h2 className="dc__h2" id="using-the-token">
            Using the token
          </h2>
          <p>
            <strong>HTTP</strong> — standard bearer header:
          </p>
          <pre className="dc__code">{`Authorization: Bearer krabs_sk_4n7q2vh3jpz9w8x1y0c5b6d4f8g2k1m3`}</pre>
          <p>
            <strong>CLI</strong> — environment variable:
          </p>
          <pre className="dc__code">{`export KRABS_API_KEY=krabs_sk_4n7q2vh3jpz9w8x1y0c5b6d4f8g2k1m3
krabs contact list`}</pre>
          <p>
            <strong>MCP</strong> — embedded in the host config:
          </p>
          <pre className="dc__code">{`{
  "mcpServers": {
    "krabs": {
      "url": "https://${BRAND.mcp}",
      "auth": { "type": "bearer", "token": "krabs_sk_…" }
    }
  }
}`}</pre>

          <h2 className="dc__h2" id="rotation">
            Rotation
          </h2>
          <p>
            Rotate a key without changing its id. The old token is invalidated immediately; the new
            token is shown once.
          </p>
          <pre className="dc__code">{`krabs auth tokens rotate key_01HGZ9X4QY8M2N7P3R5T6V8W`}</pre>
          <p>
            All metadata — label, scope, audit history — stays attached to the key id. Agents that
            reference the key by id (CI secrets, vault entries) only need their secret updated, not
            their config.
          </p>

          <h2 className="dc__h2" id="revocation">
            Revocation
          </h2>
          <p>
            From the dashboard, or CLI:
          </p>
          <pre className="dc__code">{`krabs auth tokens revoke key_01HGZ9X4QY8M2N7P3R5T6V8W`}</pre>
          <p>
            The row is soft-deleted. Every subsequent call presenting that token returns{" "}
            <code>auth_revoked</code> with the timestamp and actor of revocation.
          </p>

          <h2 className="dc__h2" id="errors">
            Errors
          </h2>
          <table className="dc__table">
            <thead>
              <tr>
                <th>code</th>
                <th>meaning</th>
                <th>recovery</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>auth_missing</code></td>
                <td>no <code>Authorization</code> header on the request</td>
                <td>attach a bearer token</td>
              </tr>
              <tr>
                <td><code>auth_invalid</code></td>
                <td>token does not match any known key hash</td>
                <td>verify the value, mint a new one if lost</td>
              </tr>
              <tr>
                <td><code>auth_expired</code></td>
                <td>token TTL has elapsed (rare; only for short-lived OAuth-issued tokens)</td>
                <td>re-authenticate or mint a long-lived key</td>
              </tr>
              <tr>
                <td><code>auth_revoked</code></td>
                <td>key id was explicitly revoked</td>
                <td>rotate or mint a replacement, update the caller</td>
              </tr>
            </tbody>
          </table>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/auth/page.tsx"
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
