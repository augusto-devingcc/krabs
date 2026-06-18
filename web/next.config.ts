import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — deployable to Cloudflare Pages with zero server runtime.
  output: "export",
  images: { unoptimized: true },

  // App-tree imports use explicit `.js` suffixes; map them to `.ts/.tsx`
  // so the bundler resolves them. (Build runs on webpack — see package.json.)
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
