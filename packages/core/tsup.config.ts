import { defineConfig } from "tsup";

export default defineConfig({
  // game-entity-keys is a subpath entry (see package.json exports): the game
  // client imports it directly so pulling the key helpers never evaluates the
  // package barrel. esm code-splitting keeps it one shared chunk — a second
  // module instance would split the active-game-id mirror the helpers read.
  // troop-stamina, expeditions and combat-exchange are too: services and the docs read a game's own rules without the
  // client's config state.
  // build-order too: the identity worker reads a player's saved orders with the game's own reader.
  entry: [
    "src/index.ts",
    "src/account/device-signer.ts",
    "src/account/transaction-resource-bounds.ts",
    "src/account/realms-account.ts",
    "src/automation/index.ts",
    "src/automation/build-order.ts",
    "src/utils/biome/biome.ts",
    "src/managers/game-entity-keys.ts",
    "src/managers/troop-stamina.ts",
    "src/utils/expeditions.ts",
    "src/utils/combat-exchange.ts",
    "src/client/index.ts",
    "src/client/shard-reader.ts",
    "src/sync/index.ts",
    "src/sync/model-manifest.ts",
  ],
  target: "esnext",
  platform: "browser",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
});
