import { configManager, dayOf, readExpeditionRules } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { relicChestRelics } from "@bibliothecadao/types";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { blitzBalance } from "../../../../../config/source/blitz/balance";
import { blitzPreset } from "../../../../../config/source/blitz/native";

import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";

const CHEST_ID = 9;
export type ChestStudyPack = Parameters<typeof relicChestRelics>[0];
export const INITIAL_PACK: ChestStudyPack = { pack: "War", lucky: false };

/** Only the rules this chest panel reads; the full rule shape starts from the existing native fixture. */
export function chestStudyGame(frontier = false) {
  if (frontier) {
    const { store } = frontierDay();
    const game = store.require("GameRegistry", { game_id: 1 });
    store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: 5 } }] as never);
    configManager.setActiveGame(1, 5);
    configManager.setStore(store);
    resetRewardChest(store);
    return store;
  }
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
      model: "GameRegistry",
      key: "0x5",
      value: {
        game_id: 1,
        preset_id: blitzPreset.id,
        name: "1",
        start_settling_at: "1",
        start_main_at: "100",
        end_at: "1000",
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: "1",
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

export function resetRewardChest(store: NativeFactStore) {
  useChainTimeStore.getState().anchor({ timestamp: 350_000 });
  store.applyFacts([
    {
      model: "SiteChest",
      key: "0xcce5",
      value: { game_id: 1, entity_id: CHEST_ID, tier: 0, amount: "17", reservation_day: "0" },
    },
  ] as never);
}

export function expireRewardChest() {
  useChainTimeStore.getState().anchor({ timestamp: 400_000 });
}

/** A local opening through the same public fact and story shapes the game receives. */
export function openFixtureChest(store: NativeFactStore, pack: ChestStudyPack, frontier = false) {
  if (frontier) {
    const now = Math.floor(useChainTimeStore.getState().nowMs! / 1000);
    const rules = readExpeditionRules(store, 1)!;
    const chest = store.require("SiteChest", { game_id: 1, entity_id: CHEST_ID });
    const amount = BigInt(dayOf(rules, now)!.index) === chest.reservation_day ? chest.amount : 0;
    store.applyEvent({
      model: "StoryEvent",
      key: "0x4",
      value: {
        game_id: 1,
        timestamp: now,
        story: { RewardChestOpened: { explorer_id: 70, structure_id: 7, coord: { alt: false, x: 0, y: 0 }, amount } },
      },
    });
    return;
  }
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
