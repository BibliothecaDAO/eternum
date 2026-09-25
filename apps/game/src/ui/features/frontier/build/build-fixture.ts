import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
export const HOUR = 3600;
const PRECISION = BigInt(RESOURCE_PRECISION);

/**
 * A Frontier realm holding 1,000 labor and growing 300 wheat an hour with no barracks yet, on a board whose workshop
 * makes 50 labor an hour.
 */
export const realmBoard = () => {
  const store = new NativeFactStore();
  store.applyFacts([set("0x100", "SliceRules", { ...preset.rules, game_id: 1 })] as never);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  store.applyFacts([
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
    ...preset.resources.map((rule) => set(`0x5${rule.resource_type}`, "ResourceRule", { ...rule, game_id: 1 })),
    ...preset.buildings.map(({ category, rule }) =>
      set(`0x6${category}`, "BuildingRule", { ...rule, category, game_id: 1 }),
    ),
    set("0x70", "BoardRules", {
      game_id: 1,
      demolition_refund_bps: 0,
      workshop_rate: String((50n * PRECISION) / BigInt(HOUR)),
    }),
    set("0x71", "ProductionRecipe", {
      game_id: 1,
      resource_type: ResourcesIds.Knight,
      simple_output: "1",
      complex_output: "1",
      simple_inputs: [{ resource_type: ResourcesIds.Wheat, amount: "2" }],
      complex_inputs: [],
    }),
    set("0x7", "Structure", {
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
    }),
    set("0x72", "StructureBuildings", {
      game_id: 1,
      entity_id: 7,
      packed_counts_1: "0",
      packed_counts_2: "0",
      packed_counts_3: "0",
      population: { current: 0, max: 6 },
    }),
    set("0x73", "ResourceWeight", { game_id: 1, entity_id: 7, capacity: "100000000000000", weight: "0" }),
    set("0x74", "ResourceProduction", {
      game_id: 1,
      entity_id: 7,
      resource_type: ResourcesIds.Wheat,
      building_count: 1,
      production_rate: String((300n * PRECISION) / BigInt(HOUR)),
      output_amount_left: "0",
      last_updated_at: 100,
    }),
    set("0x76", "TileOccupancy", {
      game_id: 1,
      alt: false,
      col: 30,
      row: 30,
      entity_id: 7,
      category: 1,
      is_structure: true,
    }),
    // Nothing researched yet; Farm II is on the board's research table with its tier rule (Frontier's preset).
    set("0x77", "RealmKnowledge", { game_id: 1, structure_id: 7, learned: 0 }),
    set("0x78", "ResearchNode", {
      game_id: 1,
      node: 0,
      prerequisites: 0,
      essence_cost: String(150n * PRECISION),
      effect: { BuildingTier: { 0: BuildingType.ResourceWheat, 1: 2 } },
    }),
    set("0x79", "BuildingTierRule", {
      game_id: 1,
      category: BuildingType.ResourceWheat,
      tier: 2,
      labor_upgrade_cost: String(200n * PRECISION),
      output_multiplier_bps: 20_000,
      capacity_multiplier_bps: 10_000,
      population_multiplier_bps: 10_000,
    }),
    set("0x75", "ResourceBalance", {
      game_id: 1,
      entity_id: 7,
      resource_type: ResourcesIds.Labor,
      balance: String(1000n * PRECISION),
    }),
  ] as never);
  setBlockTimestampSource(() => 350);
  configManager.setActiveGame(1, 3);
  configManager.setStore(store);
  return { store, realm: store.require("Structure", { game_id: 1, entity_id: 7 }) };
};
