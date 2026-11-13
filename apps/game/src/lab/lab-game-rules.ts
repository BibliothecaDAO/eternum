import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-2.json";

/**
 * Makes a lab's offline store the game the client reads its rules from (a preset's rules, as game 1): what the world's
 * production classes ask of the game, such as the map's centre, before they place anything.
 */
export function installLabGameRules(store: NativeFactStore): void {
  store.applyFacts([{ model: "SliceRules", key: "2", value: { ...preset.rules, game_id: 1 } }]);
  configManager.setActiveGame(1, 2);
  configManager.setStore(store);
}
