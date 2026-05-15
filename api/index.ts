import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/api/app.js";

export const config = {
  runtime: "nodejs",
};

const app = buildApp();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const host = (req.headers.host as string | undefined) ?? "localhost";
    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
    const url = `${proto}://${host}${req.url ?? "/"}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) for (const v of value) headers.append(key, v);
      else if (typeof value === "string") headers.set(key, value);
    }

    const method = req.method ?? "GET";
    const init: RequestInit = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
      }
      if (chunks.length > 0) init.body = Buffer.concat(chunks);
    }

    const webRequest = new Request(url, init);
    const webResponse = await app.fetch(webRequest);

    res.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await webResponse.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: { code: "INTERNAL", message: err instanceof Error ? err.message : String(err) },
        _schema_version: "1",
      }),
    );
  }
}
