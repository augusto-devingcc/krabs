import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, libsql } from "./client.js";

async function main() {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  libsql.close();
  console.log("✔ migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
