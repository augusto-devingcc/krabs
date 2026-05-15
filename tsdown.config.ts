import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "api/server": "src/api/server.ts",
    "cli/main": "src/cli/main.ts",
    "mcp/server": "src/mcp/server.ts",
  },
  format: ["esm"],
  target: "node22",
  clean: true,
  dts: false,
  sourcemap: true,
  outDir: "dist",
});
