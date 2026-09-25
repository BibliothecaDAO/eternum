import { configManager, markedPlot, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { readBuildOptions } from "./build-options";

const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
const HOUR = 3600;
const PRECISION = BigInt(RESOURCE_PRECISION);

/** A Frontier realm growing 300 wheat an hour with no barracks yet, on a board whose workshop makes 50 labor an hour. */
const realmBoard = () => {
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
      barracks_ii_cost: "0",
      barracks_iii_cost: "0",
      neighbors: [],
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
        attunement: 0,
        barracks_tier: 0,
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
  ] as never);
  setBlockTimestampSource(() => 350);
  configManager.setActiveGame(1, 3);
  configManager.setStore(store);
  return { store, realm: store.require("Structure", { game_id: 1, entity_id: 7 }) };
};

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's build options", () => {
  it("prices each building and says what it gives, doubled on the ring's marked plot", () => {
    const { store, realm } = realmBoard();
    const marked = markedPlot(1, 1);
    const plain = { col: marked.col === 10 ? 11 : 10, row: marked.row === 9 ? 11 : 9 };
    const byCategory = (plot: { col: number; row: number }) =>
      new Map(readBuildOptions(store, realm, plot, true).map((option) => [option.category, option]));
    const onPlain = byCategory(plain);
    const onMarked = byCategory(marked);

    const farmRate =
      (Number(store.require("ResourceRule", { game_id: 1, resource_type: ResourcesIds.Wheat }).realm_rate) / 1e9) *
      HOUR;
    expect(onPlain.get(BuildingType.ResourceWheat)?.effect).toEqual({
      kind: "produces",
      resource: ResourcesIds.Wheat,
      perHour: farmRate,
    });
    expect(onMarked.get(BuildingType.ResourceWheat)?.effect).toEqual({
      kind: "produces",
      resource: ResourcesIds.Wheat,
      perHour: farmRate * 2,
    });
    expect(onMarked.get(BuildingType.ResourceWheat)?.doubled).toBe(true);
    expect(onPlain.get(BuildingType.ResourceLabor)?.effect).toMatchObject({ resource: ResourcesIds.Labor });
    expect((onPlain.get(BuildingType.ResourceLabor)?.effect as { perHour: number }).perHour).toBeCloseTo(50, 0);
    expect(onPlain.get(BuildingType.Storehouse)?.effect).toEqual({
      kind: "capacity",
      amount: preset.rules.capacity_config.storehouse_boost_capacity,
    });
    const hut = preset.buildings.find(({ category }) => category === BuildingType.WorkersHut)!.rule.capacity_grant;
    expect(onMarked.get(BuildingType.WorkersHut)?.effect).toEqual({ kind: "population", amount: hut * 2 });
    expect(onPlain.get(BuildingType.ResourceWheat)?.cost.length).toBeGreaterThan(0);
    expect(onPlain.get(BuildingType.ResourceWheat)?.populationCost).toBe(
      preset.buildings.find(({ category }) => category === BuildingType.ResourceWheat)!.rule.population_cost,
    );
  });

  it("forecasts the realm's wheat once a building stands: a farm adds, a barracks eats its troops' recipe wheat", () => {
    const { store, realm } = realmBoard();
    const options = new Map(
      readBuildOptions(store, realm, { col: 11, row: 11 }, true).map((option) => [option.category, option]),
    );
    const farm = options.get(BuildingType.ResourceWheat)!;
    const barracks = options.get(BuildingType.ResourceKnightT1)!;
    expect(farm.wheatAfter).toBeCloseTo(300 + (farm.effect as { perHour: number }).perHour, 3);
    expect(barracks.wheatAfter).toBeCloseTo(300 - 2 * (barracks.effect as { perHour: number }).perHour, 3);
    expect(options.get(BuildingType.Storehouse)!.wheatAfter).toBeCloseTo(300, 3);
  });
});
