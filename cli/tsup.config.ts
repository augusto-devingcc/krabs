import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "../src/cli/main.ts" },
  outDir: "./dist",
  format: "esm",
  target: "node18",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  shims: true,
  outExtension: () => ({ js: ".js" }),
  onSuccess: "chmod +x ./dist/index.js",
});
