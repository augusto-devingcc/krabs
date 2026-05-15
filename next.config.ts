import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External contract: /v1/* remains the public surface (CLI, MCP, HTTP).
  // Internally Hono lives at app/api/v1/[...path]/route.ts.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: "/api/v1/:path*" }];
  },

  // Hono + libsql web client both work fine in the Node runtime;
  // keep the API on Node so we keep top-level await + dynamic imports.
  serverExternalPackages: ["@libsql/client", "drizzle-orm"],

  // The src/ tree uses NodeNext ESM with explicit `.js` import suffixes (so
  // tsx/Node can run it directly).  Webpack maps those `.js` to `.ts/.tsx`
  // via extensionAlias.  Turbopack does not (yet) support the same option,
  // so we build with webpack until it does.
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
