import { markedPlot, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { HOUR, realmBoard } from "./build-fixture";
import { readBuildOptions } from "./build-options";

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's build options", () => {
  it("prices each building and says what it gives, doubled on the ring's marked plot", () => {
    const { store, realm } = realmBoard();
    const marked = markedPlot(1, 1);
    const plain = { col: marked.col === 10 ? 11 : 10, row: marked.row === 9 ? 11 : 9 };
    const byCategory = (plot: { col: number; row: number }) =>
      new Map(readBuildOptions(store, realm, plot, true)!.map((option) => [option.category, option]));
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
      readBuildOptions(store, realm, { col: 11, row: 11 }, true)!.map((option) => [option.category, option]),
    );
    const farm = options.get(BuildingType.ResourceWheat)!;
    const barracks = options.get(BuildingType.ResourceKnightT1)!;
    expect(farm.wheat.change).toBeCloseTo((farm.effect as { perHour: number }).perHour, 3);
    expect(farm.wheat.after).toBeCloseTo(300 + farm.wheat.change, 3);
    expect(barracks.wheat.change).toBeCloseTo(-2 * (barracks.effect as { perHour: number }).perHour, 3);
    expect(barracks.wheat.after).toBeCloseTo(300 + barracks.wheat.change, 3);
    expect(options.get(BuildingType.Storehouse)!.wheat.change).toBe(0);
    expect(options.get(BuildingType.Storehouse)!.wheat.after).toBeCloseTo(300, 3);
  });

  it("raises a building at the realm's researched tier: its tier's output and labor, recomputed when research lands", () => {
    const { store, realm } = realmBoard();
    const farm = () =>
      readBuildOptions(store, realm, { col: 11, row: 11 }, true)!.find(
        ({ category }) => category === BuildingType.ResourceWheat,
      )!;
    const before = farm();
    expect(before.tier).toBe(1);
    store.applyFacts([
      { model: "RealmKnowledge", key: "0x77", value: { game_id: 1, structure_id: 7, learned: 1 } },
    ] as never);
    const after = farm();
    expect(after.tier).toBe(2);
    expect((after.effect as { perHour: number }).perHour).toBeCloseTo(
      (before.effect as { perHour: number }).perHour * 2,
      6,
    );
    const labor = (option: typeof before) =>
      option.cost.find(({ resource }) => resource === ResourcesIds.Labor)!.amount;
    expect(labor(after)).toBeCloseTo(labor(before) + 200, 6);
  });

  it("knows no option while the realm's research is unknown", () => {
    const { store, realm } = realmBoard();
    store.applyFacts([{ model: "RealmKnowledge", key: "0x77", value: null }] as never);
    expect(readBuildOptions(store, realm, { col: 11, row: 11 }, true)).toBeUndefined();
  });
});
