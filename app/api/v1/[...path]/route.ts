// Catch-all Next.js Route Handler — delegates every /v1/* request to our
// Hono app. External callers (CLI, MCP, HTTP clients) hit /v1/whatever;
// next.config rewrites that to /api/v1/whatever which lands here.
import { buildApp } from "../../../../src/api/app.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const app = buildApp();

async function handler(req: Request): Promise<Response> {
  return app.fetch(req);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
