import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
const realm = {
  game_id: 1,
  entity_id: 7,
  owner: "0x111",
  base: {
    category: 1,
    level: 0,
    created_at: "0x1",
    troop_max_guard_count: 0,
    troop_max_explorer_count: 3,
    starting_troops_granted: false,
  },
  resources_packed: "0x0",
  metadata: {
    realm_id: 1,
    village_realm: 0,
    mine_kind: 0,
    deepest_depth: 0,
    has_wonder: false,
    order: 0,
  },
};

/** A Frontier day at epoch 3: the realm owns 420 T1 knights and one of its three slots holds an army. */
export const frontierDay = () => {
  const store = new NativeFactStore();
  store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100 })] as never);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  store.applyFacts([
    set("0x2", "SettlementRules", {
      game_id: 1,
      registration_start: 1,
      registration_limit: 2,
      spacing: 10,
      mode: "Single",
    }),
    set("0x3", "GameRegistry", {
      game_id: 1,
      preset_id: 3,
      name: "1",
      creator: "1",
      start_settling_at: "1",
      start_main_at: "100",
      end_at: "1000",
      settled: false,
      ready: true,
      dev_mode_on: false,
      end_grace_seconds: 0,
      seed: "1",
    }),
    set("0x7", "Structure", realm),
    ...preset.resources.map((rule) => set(`0x5${rule.resource_type}`, "ResourceRule", { ...rule, game_id: 1 })),
    set("0x6", "ResourceWeight", { game_id: 1, entity_id: 7, capacity: "100000000000000", weight: "0" }),
    set("0x8", "ResourceBalance", {
      game_id: 1,
      entity_id: 7,
      resource_type: 26,
      balance: String(420n * BigInt(RESOURCE_PRECISION)),
    }),
    set("0x9", "ArmySlot", {
      game_id: 1,
      structure_id: 7,
      epoch: "3",
      slot: 0,
      explorer_id: 70,
      stamina: { amount: "30", updated_tick: "3" },
    }),
  ] as never);
  setBlockTimestampSource(() => 350);
  configManager.setActiveGame(1, 3);
  configManager.setStore(store);
  return { store, row: store.require("Structure", { game_id: 1, entity_id: 7 }) };
};
