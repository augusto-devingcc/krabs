import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/api/server.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  dts: false,
  sourcemap: true,
  outDir: "dist",
});
