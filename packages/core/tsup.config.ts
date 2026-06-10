import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  target: "esnext",
  platform: "browser",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  external: ["@dojoengine/torii-client"],
});
