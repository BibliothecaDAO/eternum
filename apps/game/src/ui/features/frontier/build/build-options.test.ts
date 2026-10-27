import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { nativeResearchConstants } from "@bibliothecadao/eternum/game-client";
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
      // Nothing researched: the output is its base, with no share added.
      output: { base: farmRate / HOUR, total: farmRate / HOUR },
      research: undefined,
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

  it("gives each Fields pick a quarter more output, and the next Hut its grant and the bonus its tiers add, at no extra price", () => {
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
    // No Hut stands: the first adds its grant and its share of the epic tier's bonus, rounded down as the contract
    // rounds it (6 + floor(6 × 3 × 2,500 / 10,000) = 6 + 4), never a fraction.
    const grant = (hut.effect as { amount: number }).amount;
    expect((option(BuildingType.WorkersHut).effect as { amount: number }).amount).toBe(
      grant + Math.floor((grant * 3 * 2_500) / 10_000),
    );
  });

  it("offers every building the contract's tree names for a board, from its generated constants", () => {
    const { store, realm } = realmBoard();
    // research.cairo names each board building by its category (FARM, WORKSHOP, …): a building it adds is offered,
    // or this fails (the catalog rule, audit 10-27 F7), never a hand-written list missing it.
    const named = Object.entries(nativeResearchConstants)
      .filter(([name]) => !/^(ROW_|CHOICE_|KIND_)/.test(name))
      .map(([, category]) => category)
      .sort((a, b) => a - b);
    const offered = readBuildOptions(store, realm, true, 350)!.map(({ category }) => category);
    expect([...offered].sort((a, b) => a - b)).toEqual(named);
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
