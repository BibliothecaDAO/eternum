import { defineConfig } from "tsup";

export default defineConfig({
  // game-entity-keys is a subpath entry (see package.json exports): the game
  // client imports it directly so pulling the key helpers never evaluates the
  // package barrel. esm code-splitting keeps it one shared chunk — a second
  // module instance would split the active-game-id mirror the helpers read.
  entry: ["src/index.ts", "src/managers/game-entity-keys.ts", "src/sync/index.ts", "src/sync/model-manifest.ts"],
  target: "esnext",
  platform: "browser",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
});
