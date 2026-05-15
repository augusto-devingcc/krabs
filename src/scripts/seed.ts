import "dotenv/config";
import { db, libsql } from "../db/client.js";
import { accounts, apiKeys } from "../db/schema.js";
import { newId } from "../contract/ids.js";
import { generateApiKeyPlaintext, sha256Hex, apiKeyPreview } from "../lib/hash.js";

async function main() {
  const email = process.argv[2] ?? "dev@socrm.local";
  const label = process.argv[3] ?? "seed";

  const accountId = newId("account");
  const apiKeyId = newId("apiKey");
  const plaintext = generateApiKeyPlaintext();

  await db.insert(accounts).values({ id: accountId, email, name: "Dev Account" });
  await db.insert(apiKeys).values({
    id: apiKeyId,
    accountId,
    label,
    tokenHash: sha256Hex(plaintext),
    tokenPreview: apiKeyPreview(plaintext),
  });

  libsql.close();

  console.log("✔ seeded");
  console.log(`  account:  ${accountId} (${email})`);
  console.log(`  api key:  ${apiKeyId} (${label})`);
  console.log(`  token:    ${plaintext}`);
  console.log("");
  console.log(`  curl -s -H "Authorization: Bearer ${plaintext}" http://localhost:3000/v1/me`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
