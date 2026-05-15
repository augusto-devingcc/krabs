import "dotenv/config";
import { serve } from "@hono/node-server";
import { buildApp } from "./app.js";
import { logger } from "@/lib/logger.js";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp();

serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, "socrm api listening");
});
