import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  target: "esnext",
  platform: "browser",
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
});
