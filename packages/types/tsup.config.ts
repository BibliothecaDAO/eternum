import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/terrain.ts"],
  target: "esnext",
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
});
