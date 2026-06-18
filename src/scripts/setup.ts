import "dotenv/config";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  unlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { accounts, apiKeys } from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } from "../lib/hash.js";
import { readConfig, writeConfig } from "../cli/config.js";
import { eq } from "drizzle-orm";

type Flags = {
  email: string;
  name: string;
  apiUrl: string;
  force: boolean;
  noWriteMcp: boolean;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    email: "dev@krabs.local",
    name: "Local operator",
    apiUrl: "http://localhost:3000",
    force: false,
    noWriteMcp: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") flags.email = argv[++i] ?? flags.email;
    else if (a === "--name") flags.name = argv[++i] ?? flags.name;
    else if (a === "--api-url") flags.apiUrl = argv[++i] ?? flags.apiUrl;
    else if (a === "--force") flags.force = true;
    else if (a === "--no-write-mcp") flags.noWriteMcp = true;
  }
  return flags;
}

type McpHost = {
  name: string;
  configPath: string;
  /** Friendly hint about what app reads this file. */
  app: string;
};

/**
 * Known MCP host config locations. Returns the ones that already exist on disk
 * (so we don't materialize stray dirs for apps the user doesn't have). The
 * caller can still pass `--no-write-mcp` to skip writes entirely.
 */
function discoverMcpHosts(): McpHost[] {
  const home = os.homedir();
  const hosts: McpHost[] = [];

  // Claude Desktop — macOS, Linux, Windows
  const claudeCandidates =
    process.platform === "darwin"
      ? [path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")]
      : process.platform === "win32"
      ? [
          path.join(
            process.env["APPDATA"] ?? path.join(home, "AppData", "Roaming"),
            "Claude",
            "claude_desktop_config.json",
          ),
        ]
      : [path.join(home, ".config", "Claude", "claude_desktop_config.json")];

  for (const p of claudeCandidates) {
    hosts.push({ name: "claude-desktop", configPath: p, app: "Claude Desktop" });
  }

  // Cursor — per-user mcp.json (universal across platforms)
  hosts.push({
    name: "cursor",
    configPath: path.join(home, ".cursor", "mcp.json"),
    app: "Cursor",
  });

  // VS Code Continue (informal — write only if file already exists)
  hosts.push({
    name: "continue",
    configPath: path.join(home, ".continue", "config.json"),
    app: "Continue (VS Code)",
  });

  return hosts;
}

type WriteOutcome =
  | { host: McpHost; status: "wrote"; created: boolean; backup?: string }
  | { host: McpHost; status: "skipped-not-found" }
  | { host: McpHost; status: "skipped-error"; error: string };

/**
 * Idempotently merge a `krabs` MCP-server entry into the host's config file.
 * Only writes when:
 *   - the file already exists (we never materialize configs for apps the user
 *     doesn't have), OR
 *   - the file's parent directory already exists (the app has been opened at
 *     least once, even if it hasn't written its own config yet).
 * Preserves every other key in the file. Atomically writes via tmp + rename.
 */
function mergeKrabsIntoMcpConfig(
  host: McpHost,
  entry: { command: string; args: string[]; env: Record<string, string> },
): WriteOutcome {
  const fileExists = existsSync(host.configPath);
  const parentExists = existsSync(path.dirname(host.configPath));
  if (!fileExists && !parentExists) {
    return { host, status: "skipped-not-found" };
  }

  try {
    let current: { mcpServers?: Record<string, unknown>; [k: string]: unknown } = {};
    let backup: string | undefined;

    if (fileExists) {
      const raw = readFileSync(host.configPath, "utf8").trim();
      if (raw.length > 0) {
        current = JSON.parse(raw);
        // Back up the original once per setup run.
        backup = `${host.configPath}.krabs-backup-${Date.now()}`;
        copyFileSync(host.configPath, backup);
      }
    } else {
      mkdirSync(path.dirname(host.configPath), { recursive: true });
    }

    const mcpServers =
      typeof current.mcpServers === "object" && current.mcpServers !== null
        ? (current.mcpServers as Record<string, unknown>)
        : {};

    const merged = {
      ...current,
      mcpServers: {
        ...mcpServers,
        krabs: entry,
      },
    };

    const tmp = `${host.configPath}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
    writeFileSync(host.configPath, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
    try {
      unlinkSync(tmp);
    } catch {
      /* tmp cleanup is best-effort */
    }

    return { host, status: "wrote", created: !fileExists, ...(backup ? { backup } : {}) };
  } catch (err) {
    return {
      host,
      status: "skipped-error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  const url = process.env.DATABASE_URL ?? "file:./data/local.db";

  // Refuse remote targets so a stray TURSO_DATABASE_URL or libsql:// URL
  // can't cause us to nuke production accounts.
  if (process.env.TURSO_DATABASE_URL) {
    throw new Error(
      "TURSO_DATABASE_URL is set. `pnpm setup` is for local single-user mode only — refusing to run against a remote database.",
    );
  }
  if (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  ) {
    throw new Error(
      `DATABASE_URL points at a remote target (${url}). \`pnpm setup\` is for local single-user mode only — use a file:./ URL.`,
    );
  }

  // libSQL won't create the parent directory itself — fresh clones don't have
  // ./data yet, so do that ourselves before opening the connection.
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length).replace(/^\/+/, "");
    const dir = path.dirname(filePath);
    if (dir && dir !== "." && dir !== "/") {
      mkdirSync(dir, { recursive: true });
    }
  }

  const client = createClient({ url });
  const db = drizzle(client, { schema: { accounts, apiKeys } });

  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  // ── Idempotent setup ────────────────────────────────────────
  // First run                 → create account + api key, write config
  // Re-run, config has token   → reuse account, reuse key if its hash matches
  // Re-run, config gone        → reuse account, mint a fresh key, write config
  // Re-run with --force        → drop account (cascade), start over
  const existingAccount = await db.select().from(accounts).limit(1).then((r) => r[0]);

  let accountId: string;
  let plaintext: string;
  let apiKeyId: string;
  let mode: "fresh" | "reused" | "rotated" | "forced";

  if (existingAccount && !flags.force) {
    accountId = existingAccount.id;
    const cfg = readConfig();
    if (cfg.token) {
      const tokenHash = sha256Hex(cfg.token);
      const matchingKey = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.tokenHash, tokenHash))
        .limit(1)
        .then((r) => r[0]);
      if (matchingKey) {
        // Both the account and the stored API key are intact — perfectly idempotent.
        plaintext = cfg.token;
        apiKeyId = matchingKey.id;
        mode = "reused";
      } else {
        // Account survived but the key was deleted (or config.json got out of sync).
        // Mint a fresh key against the same account.
        apiKeyId = newId("apiKey");
        plaintext = generateApiKeyPlaintext();
        await db.insert(apiKeys).values({
          id: apiKeyId,
          accountId,
          label: "Local operator key (rotated)",
          tokenHash: sha256Hex(plaintext),
          tokenPreview: apiKeyPreview(plaintext),
        });
        mode = "rotated";
      }
    } else {
      // No config on disk — account exists from a previous run, mint a new key.
      apiKeyId = newId("apiKey");
      plaintext = generateApiKeyPlaintext();
      await db.insert(apiKeys).values({
        id: apiKeyId,
        accountId,
        label: "Local operator key (rotated)",
        tokenHash: sha256Hex(plaintext),
        tokenPreview: apiKeyPreview(plaintext),
      });
      mode = "rotated";
    }
  } else {
    if (existingAccount) await db.delete(accounts); // --force: cascade everything
    accountId = newId("account");
    apiKeyId = newId("apiKey");
    plaintext = generateApiKeyPlaintext();
    await db.insert(accounts).values({
      id: accountId,
      email: flags.email,
      name: flags.name,
    });
    await db.insert(apiKeys).values({
      id: apiKeyId,
      accountId,
      label: "Local operator key",
      tokenHash: sha256Hex(plaintext),
      tokenPreview: apiKeyPreview(plaintext),
    });
    mode = existingAccount ? "forced" : "fresh";
  }

  const cfgPath = writeConfig({ apiUrl: flags.apiUrl, token: plaintext });

  client.close();

  const mcpEntry = {
    command: "node",
    args: [path.resolve(process.cwd(), "dist", "mcp", "server.mjs")],
    env: {
      KRABS_API_URL: flags.apiUrl,
      KRABS_API_KEY: plaintext,
    },
  };

  const modeLabel = {
    fresh: "new install",
    reused: "existing install · account + token reused",
    rotated: "existing install · token rotated",
    forced: "wiped and recreated (--force)",
  }[mode];

  console.log("");
  console.log(`✔ krabs is ready  (${modeLabel})`);
  console.log("");
  console.log(`  account_id  ${accountId}`);
  console.log(`  email       ${existingAccount && mode !== "forced" ? existingAccount.email : flags.email}`);
  console.log(`  api_url     ${flags.apiUrl}`);
  console.log(`  token       ${plaintext}  (also saved to ${cfgPath})`);
  console.log("");

  // ── Wire up the agent host(s) automatically ────────────────
  if (!flags.noWriteMcp) {
    console.log("─── Wiring krabs into your MCP-capable agent hosts ──────────");
    const outcomes = discoverMcpHosts().map((host) => mergeKrabsIntoMcpConfig(host, mcpEntry));
    let wroteAny = false;
    for (const o of outcomes) {
      if (o.status === "wrote") {
        wroteAny = true;
        console.log(
          `  ✓ ${o.host.app.padEnd(20)} ${o.host.configPath}` +
            (o.created ? "  (created)" : ""),
        );
        if (o.backup) console.log(`      backup: ${o.backup}`);
      } else if (o.status === "skipped-not-found") {
        console.log(`  · ${o.host.app.padEnd(20)} not installed (skipped)`);
      } else if (o.status === "skipped-error") {
        console.log(`  ! ${o.host.app.padEnd(20)} ${o.error}`);
      }
    }
    if (!wroteAny) {
      console.log("");
      console.log("  No MCP host detected — copy the snippet below into your host's config:");
      console.log("");
      console.log(JSON.stringify({ mcpServers: { krabs: mcpEntry } }, null, 2));
    }
    console.log("");
  } else {
    console.log("─── MCP config (--no-write-mcp set, paste this yourself) ────");
    console.log(JSON.stringify({ mcpServers: { krabs: mcpEntry } }, null, 2));
    console.log("");
  }

  console.log("Next steps:");
  console.log("  1. Start the API:    pnpm dev:api   (in another terminal)");
  console.log("  2. Restart Claude Desktop / Cursor so it loads the new MCP server");
  console.log("  3. In your agent, say:");
  console.log('       "Call schema.describe on krabs, then record my income and expenses."');
  console.log("");
  console.log("Everything (products, subscriptions, invoices, expenses, finance");
  console.log("reporting) is reachable over MCP / CLI / HTTP with the same contract.");
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
