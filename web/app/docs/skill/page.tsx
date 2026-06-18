import Link from "next/link";
import { Callout } from "@/components/docs/Callout";
import { DocsToc } from "@/components/docs/DocsToc";

const TOC = [
  { id: "whats-a-skill", label: "What's a skill" },
  { id: "install-claude-code", label: "Install in Claude Code" },
  { id: "use-as-prompt", label: "Use as raw prompt" },
  { id: "fetch-dynamically", label: "Fetch at runtime" },
  { id: "whats-inside", label: "What's inside" },
  { id: "prefer-mcp", label: "Prefer MCP for live tools" },
];

export default function DocsSkillPage() {
  return (
    <>
      <main className="docs-center">
        <article className="dc">
          <div className="dc__breadcrumb">docs / agent skill</div>
          <h1 className="dc__h1">Agent skill</h1>
          <p className="dc__lede">
            Drop krabs into your agent in one file. <code>skill.md</code> contains everything an
            agent needs to operate krabs end-to-end — primitives, transports, auth, voice rules,
            common operations, and error recovery.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              margin: "8px 0 28px",
            }}
          >
            <a
              href="/skill.md"
              download="krabs-skill.md"
              className="mk-btn mk-btn--primary mk-btn--lg"
            >
              Download skill.md ↗
            </a>
            <a
              href="/skill.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mk-btn mk-btn--secondary mk-btn--lg"
            >
              View source
            </a>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
                marginLeft: 6,
              }}
            >
              ~7 KB · v0.5.0
            </span>
          </div>

          <h2 className="dc__h2" id="whats-a-skill">
            What&apos;s a skill
          </h2>
          <p>
            A skill is a single Markdown file with a YAML frontmatter that an agent host can ingest
            as durable knowledge. The format originated with Claude Code (Anthropic&apos;s CLI), but
            the convention is generic enough that you can load it into any agent runtime as a
            system message, a tool description, or static context.
          </p>
          <p>
            <code>krabs-skill.md</code> is the one we publish — it carries the verb/noun vocabulary,
            the three transports, the auth flow, the voice rules, and the common operations agents
            will need most.
          </p>

          <Callout tone="info" title="versioned, stable URL">
            <code>https://krabs.dev/skill.md</code> always returns the current skill for the
            current API version. Pin a version with <code>?v=0.4.3</code> if you want to lock.
          </Callout>

          <h2 className="dc__h2" id="install-claude-code">
            Install in Claude Code
          </h2>
          <p>Drop the file into your Claude Code skills directory:</p>
          <pre className="dc__code">{`mkdir -p ~/.claude/skills/krabs
curl -fsSL https://krabs.dev/skill.md -o ~/.claude/skills/krabs/SKILL.md`}</pre>
          <p>
            Claude Code picks it up next time you start a session. Invoke the skill with{" "}
            <code>/krabs</code> or let Claude decide based on the description in the frontmatter.
          </p>

          <h2 className="dc__h2" id="use-as-prompt">
            Use as a raw prompt
          </h2>
          <p>
            For hosts that don&apos;t natively support skills (custom agents, raw API calls,
            LangChain, etc.) prepend the file to your system message:
          </p>
          <pre className="dc__code">{`SKILL = fetch("https://krabs.dev/skill.md").text()
messages = [
  { role: "system", content: SKILL },
  { role: "user",   content: userPrompt },
]`}</pre>
          <p>
            The agent now has the full krabs vocabulary in context. Token cost is ~2k tokens.
          </p>

          <h2 className="dc__h2" id="fetch-dynamically">
            Fetch at runtime
          </h2>
          <p>
            The skill changes with each minor version. If your agent calls krabs in production
            and you want to track the latest contract automatically, fetch the skill at startup
            and cache it for the session:
          </p>
          <pre className="dc__code">{`# Bash
SKILL=$(curl -fsSL https://krabs.dev/skill.md)

# Node
const skill = await (await fetch("https://krabs.dev/skill.md")).text()

# Python
skill = httpx.get("https://krabs.dev/skill.md").text`}</pre>

          <h2 className="dc__h2" id="whats-inside">
            What&apos;s inside
          </h2>
          <p>The skill covers everything an agent needs to operate krabs without prior context:</p>
          <ul>
            <li>How to invoke krabs over each transport (MCP, CLI, HTTP) with copyable snippets.</li>
            <li>
              The 4 finance primitives (<code>product</code>, <code>subscription</code>,{" "}
              <code>invoice</code>, <code>expense</code>) plus finance reporting, with id prefixes.
            </li>
            <li>
              How to mint and rotate auth tokens with <code>pnpm setup</code> and{" "}
              <code>krabs key create</code>.
            </li>
            <li>
              The five contract guarantees: intent, idempotency, dry-run, schema introspection,
              reversible audit.
            </li>
            <li>Common operations with concrete commands (create invoice, record expense, finance report).</li>
            <li>
              All error codes (<code>auth_*</code>, <code>rate_limited</code>,{" "}
              <code>not_found</code>, <code>conflict</code>, <code>validation</code>) with recovery
              hints.
            </li>
            <li>
              krabs voice rules so user-facing copy the agent writes stays on-brand (lowercase
              product name, no marketing softeners, sentence case, no emoji).
            </li>
          </ul>

          <h2 className="dc__h2" id="prefer-mcp">
            Prefer MCP for live tools
          </h2>
          <p>
            The skill is static knowledge. The MCP server (<code>mcp.krabs.dev</code>) is live
            execution. If your host supports both, do both:
          </p>
          <ul>
            <li>Mount the MCP server so the agent has actual callable tools.</li>
            <li>
              Load the skill so the agent has the conceptual model, voice rules, and recovery logic.
            </li>
          </ul>
          <p>
            MCP without the skill works — but the agent will likely call tools without the voice or
            error-handling sophistication krabs expects.
          </p>

          <Callout tone="warning" title="skill drift">
            If you self-host or fork the skill, set a calendar reminder to re-sync against{" "}
            <a href="https://krabs.dev/skill.md">krabs.dev/skill.md</a> at every minor version.
            Drift between your skill and the live contract is a slow source of bugs.
          </Callout>

          <div className="dc__edit">
            <a
              href="https://github.com/augusto-devingcc/krabs/edit/main/app/docs/skill/page.tsx"
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
