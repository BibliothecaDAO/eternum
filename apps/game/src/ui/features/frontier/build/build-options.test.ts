import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { HOUR, realmBoard } from "./build-fixture";
import { readBuildOptions } from "./build-options";

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's build options", () => {
  it("prices each building and says what it gives", () => {
    const { store, realm } = realmBoard();
    const options = new Map(readBuildOptions(store, realm, true, 350)!.map((option) => [option.category, option]));

    const farmRate =
      (Number(store.require("ResourceRule", { game_id: 1, resource_type: ResourcesIds.Wheat }).realm_rate) / 1e9) *
      HOUR;
    expect(options.get(BuildingType.ResourceWheat)?.effect).toEqual({
      kind: "produces",
      resource: ResourcesIds.Wheat,
      perHour: farmRate,
    });
    expect(options.get(BuildingType.ResourceLabor)?.effect).toMatchObject({ resource: ResourcesIds.Labor });
    expect((options.get(BuildingType.ResourceLabor)?.effect as { perHour: number }).perHour).toBeCloseTo(50, 0);
    expect(options.has(BuildingType.Storehouse)).toBe(false);
    const hut = preset.buildings.find(({ category }) => category === BuildingType.WorkersHut)!.rule.capacity_grant;
    expect(options.get(BuildingType.WorkersHut)?.effect).toEqual({ kind: "population", amount: hut });
    expect(options.get(BuildingType.ResourceWheat)?.cost.length).toBeGreaterThan(0);
    expect(options.get(BuildingType.ResourceWheat)?.populationCost).toBe(
      preset.buildings.find(({ category }) => category === BuildingType.ResourceWheat)!.rule.population_cost,
    );
  });

  it("forecasts the realm's wheat once a building stands: a farm adds, a barracks takes none", () => {
    const { store, realm } = realmBoard();
    const options = new Map(readBuildOptions(store, realm, true, 350)!.map((option) => [option.category, option]));
    const farm = options.get(BuildingType.ResourceWheat)!;
    const barracks = options.get(BuildingType.ResourceKnightT1)!;
    expect(farm.wheat.change).toBeCloseTo((farm.effect as { perHour: number }).perHour, 3);
    expect(farm.wheat.after).toBeCloseTo(300 + farm.wheat.change, 3);
    expect(barracks.wheat.change).toBe(0);
    expect(barracks.wheat.after).toBeCloseTo(300, 3);
  });

  it("gives each Fields pick a quarter more output and each hut tier a quarter more room, at no extra price", () => {
    const { store, realm } = realmBoard();
    const option = (category: BuildingType) =>
      readBuildOptions(store, realm, true, 350)!.find((candidate) => candidate.category === category)!;
    const farm = option(BuildingType.ResourceWheat);
    const hut = option(BuildingType.WorkersHut);
    expect(farm.tier).toBe(1);
    // research.cairo: Farm rare (Fields, then Granary) at bits 0 and 3-4; Hut epic at bit 21.
    store.applyFacts([
      {
        model: "RealmKnowledge",
        key: "0x77",
        value: { game_id: 1, structure_id: 7, learned: 2n | (1n << 4n) | (3n << 21n) },
      },
    ] as never);
    const farmAfter = option(BuildingType.ResourceWheat);
    expect(farmAfter.tier).toBe(3);
    expect((farmAfter.effect as { perHour: number }).perHour).toBeCloseTo(
      (farm.effect as { perHour: number }).perHour * 1.25,
      6,
    );
    expect(farmAfter.cost).toEqual(farm.cost);
    expect((option(BuildingType.WorkersHut).effect as { amount: number }).amount).toBe(
      (hut.effect as { amount: number }).amount * 1.75,
    );
  });

  it("knows no option while the realm's research is unknown", () => {
    const { store, realm } = realmBoard();
    store.applyFacts([{ model: "RealmKnowledge", key: "0x77", value: null }] as never);
    expect(readBuildOptions(store, realm, true, 350)).toBeUndefined();
  });

  it("offers each training building once the Barracks row reaches the board's gate tier, trained at its own tier", () => {
    const { store, realm } = realmBoard();
    const warHall = () =>
      readBuildOptions(store, realm, true, 350)!.find(({ category }) => category === BuildingType.WarHall)!;
    const gate = store.require("BoardRules", { game_id: 1 }).training_gate_tier;
    expect(warHall()).toMatchObject({ standing: { gate }, effect: { kind: "trains", attribute: "Battle" }, tier: 1 });
    // research.cairo: the Barracks row's tier sits at 0x4000.
    store.applyFacts([
      {
        model: "RealmKnowledge",
        key: "0x77",
        value: { game_id: 1, structure_id: realm.entity_id, learned: BigInt(gate) * 0x4000n },
      },
    ] as never);
    expect(warHall().standing).toBe("open");
  });
});
