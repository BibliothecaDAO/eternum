import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { relicChestRelics } from "@bibliothecadao/types";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { blitzBalance } from "../../../../../config/source/blitz/balance";
import { blitzPreset } from "../../../../../config/source/blitz/native";

const CHEST_ID = 9;
export type ChestStudyPack = Parameters<typeof relicChestRelics>[0];
export const INITIAL_PACK: ChestStudyPack = { pack: "War", lucky: false };

/** Only the rules this chest panel reads; the full rule shape starts from the existing native fixture. */
export function chestStudyGame() {
  const store = new NativeFactStore();
  store.applyFacts([
    {
      model: "SliceRules",
      key: "0x1",
      value: {
        ...preset.rules,
        game_id: 1,
        mode_rules: blitzPreset.modeRules,
        victory_points_grant_config: {
          ...preset.rules.victory_points_grant_config,
          relic_open_points: String(blitzBalance.victoryPoints!.pointsForRelicDiscovery),
        },
      },
    },
    {
      model: "SettlementRules",
      key: "0x2",
      value: { game_id: 1, registration_start: 1, registration_limit: 24, spacing: 6, mode: "Triple" },
    },
  ] as never);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  configManager.setActiveGame(1, blitzPreset.id);
  configManager.setStore(store);
  setChestPack(store, INITIAL_PACK);
  return store;
}

export function setChestPack(store: NativeFactStore, pack: ChestStudyPack) {
  store.applyFacts([{ model: "RelicChest", key: "0x3", value: { game_id: 1, entity_id: CHEST_ID, ...pack } }] as never);
}

/** A local opening through the same public fact and story shapes the game receives. */
export function openFixtureChest(store: NativeFactStore, pack: ChestStudyPack) {
  store.applyFacts([{ model: "RelicChest", key: "0x3", value: null }]);
  store.applyEvent({
    model: "StoryEvent",
    key: "0x4",
    value: {
      game_id: 1,
      timestamp: 350,
      story: {
        RelicChestOpened: {
          explorer_id: 70,
          coord: { alt: false, x: 0, y: 0 },
          chest: pack,
          relics: relicChestRelics(pack),
          points: String(blitzBalance.victoryPoints!.pointsForRelicDiscovery),
        },
      },
    },
  });
}
