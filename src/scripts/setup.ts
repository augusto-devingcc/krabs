import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { accounts, apiKeys } from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } from "../lib/hash.js";
import { writeConfig } from "../cli/config.js";

type Flags = {
  email: string;
  name: string;
  apiUrl: string;
  force: boolean;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    email: "dev@krabs.local",
    name: "Local operator",
    apiUrl: "http://localhost:3000",
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") flags.email = argv[++i] ?? flags.email;
    else if (a === "--name") flags.name = argv[++i] ?? flags.name;
    else if (a === "--api-url") flags.apiUrl = argv[++i] ?? flags.apiUrl;
    else if (a === "--force") flags.force = true;
  }
  return flags;
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

  const client = createClient({ url });
  const db = drizzle(client, { schema: { accounts, apiKeys } });

  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  const existing = await db.select({ id: accounts.id }).from(accounts).limit(1);
  if (existing.length > 0) {
    if (!flags.force) {
      client.close();
      throw new Error(
        "Setup already run. Pass --force to reset and create a new operator account.",
      );
    }
    await db.delete(accounts);
  }

  const accountId = newId("account");
  const apiKeyId = newId("apiKey");
  const plaintext = generateApiKeyPlaintext();

  await db.insert(accounts).values({
    id: accountId,
    email: flags.email,
    name: flags.name,
    clerkUserId: null,
  });

  await db.insert(apiKeys).values({
    id: apiKeyId,
    accountId,
    label: "Local operator key",
    tokenHash: sha256Hex(plaintext),
    tokenPreview: apiKeyPreview(plaintext),
  });

  const cfgPath = writeConfig({ apiUrl: flags.apiUrl, token: plaintext });

  client.close();

  console.log("");
  console.log("✔ krabs is ready");
  console.log("");
  console.log(`  account_id  ${accountId}`);
  console.log(`  email       ${flags.email}`);
  console.log(`  api_url     ${flags.apiUrl}`);
  console.log(`  token       ${plaintext}  (also saved to ${cfgPath})`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Run `pnpm dev` (or `docker compose up`) to start the API");
  console.log("  2. Try:  krabs schema describe");
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
