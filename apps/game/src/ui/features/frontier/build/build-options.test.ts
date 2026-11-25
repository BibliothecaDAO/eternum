import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { nativeResearchConstants } from "@bibliothecadao/eternum/game-client";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { afterEach, describe, expect, it } from "vitest";
import { HOUR, realmBoard } from "./build-fixture";
import { readBuildOptions } from "./build-options";

afterEach(() => setBlockTimestampSource(null));

describe("Frontier's build options", () => {
  it("prices each building and says what it gives", () => {
    const { store, realm } = realmBoard();
    const options = new Map(readBuildOptions(store, realm, true, 350)!.map((option) => [option.category, option]));

    const farmASecond =
      Number(store.require("ResourceRule", { game_id: 1, resource_type: ResourcesIds.Wheat }).realm_rate) / 1e9;
    expect(options.get(BuildingType.ResourceWheat)?.effect).toEqual({
      kind: "produces",
      resource: ResourcesIds.Wheat,
      perHour: farmASecond * HOUR,
    });
    expect(options.get(BuildingType.ResourceLabor)?.effect).toMatchObject({ resource: ResourcesIds.Labor });
    expect((options.get(BuildingType.ResourceLabor)?.effect as { perHour: number }).perHour).toBeCloseTo(50, 0);
    expect(options.get(BuildingType.Storehouse)?.effect).toEqual({ kind: "stores", shareBps: 5000 });
    expect(options.has(BuildingType.WorkersHut)).toBe(false);
    expect(options.get(BuildingType.ResourceWheat)?.cost.length).toBeGreaterThan(0);
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

  it("gives each Farm tier a quarter more output at no extra price", () => {
    const { store, realm } = realmBoard();
    const option = (category: BuildingType) =>
      readBuildOptions(store, realm, true, 350)!.find((candidate) => candidate.category === category)!;
    const farm = option(BuildingType.ResourceWheat);
    expect(farm.tier).toBe(0);
    store.applyFacts([
      {
        model: "RealmKnowledge",
        key: "0x77",
        value: { game_id: 1, structure_id: 7, learned: 1n },
      },
    ] as never);
    const farmAfter = option(BuildingType.ResourceWheat);
    expect(farmAfter.tier).toBe(1);
    expect((farmAfter.effect as { perHour: number }).perHour).toBeCloseTo(
      (farm.effect as { perHour: number }).perHour * 1.25,
      6,
    );
    expect(farmAfter.cost).toEqual(farm.cost);
  });

  it("offers every building the contract's tree names for a board, from its generated constants", () => {
    const { store, realm } = realmBoard();
    // research.cairo names each board building by its category (FARM, WORKSHOP, …): a building it adds is offered,
    // or this fails (the catalog rule, audit 10-27 F7), never a hand-written list missing it.
    const named = Object.entries(nativeResearchConstants)
      .filter(
        ([name]) =>
          !name.startsWith("ROW_") &&
          !name.startsWith("OATH_SLOTS_") &&
          !name.startsWith("LORE_") &&
          !name.endsWith("_LEVEL"),
      )
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

  it("opens Logistics training at Kingdom without a Barracks research gate", () => {
    const { store, realm } = realmBoard();
    const supplyYard = (level: number) =>
      readBuildOptions(store, { ...realm, base: { ...realm.base, level } }, true, 350)!.find(
        ({ category }) => category === BuildingType.SupplyYard,
      )!;
    expect(supplyYard(1).standing).toEqual({ level: 2 });
    expect(supplyYard(2)).toMatchObject({
      standing: "open",
      effect: { kind: "trains", attribute: "Logistics" },
      tier: 1,
    });
  });
});

it("opens repeatable Scout production at City without Barracks research", () => {
  const { store, realm } = realmBoard();
  const lodge = (level: number) =>
    readBuildOptions(store, { ...realm, base: { ...realm.base, level } }, true, 350)!.find(
      ({ category }) => category === BuildingType.ScoutsLodge,
    )!;
  expect(lodge(0).standing).toEqual({ level: 1 });
  expect(lodge(1).standing).toBe("open");
  expect(lodge(1).effect).toMatchObject({ kind: "produces", resource: ResourcesIds.Paladin });
  expect(lodge(1).tier).toBe(1);
});

it("opens the Range and Camp at City, the Depot at Kingdom, and keeps each research building unique", () => {
  const { store, realm } = realmBoard();
  const options = (level: number) =>
    new Map(
      readBuildOptions(store, { ...realm, base: { ...realm.base, level } }, true, 350)!.map((option) => [
        option.category,
        option,
      ]),
    );
  expect(options(0).get(BuildingType.ResourceCrossbowmanT1)?.standing).toEqual({ level: 1 });
  expect(options(0).get(BuildingType.ConscriptionCamp)?.standing).toEqual({ level: 1 });
  expect(options(1).get(BuildingType.ResourceCrossbowmanT1)?.standing).toBe("open");
  expect(options(1).get(BuildingType.ConscriptionCamp)?.standing).toBe("open");
  expect(options(1).get(BuildingType.RationsDepot)?.standing).toEqual({ level: 2 });
  expect(options(2).get(BuildingType.RationsDepot)?.standing).toBe("open");
  const counts = store.require("StructureBuildings", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    {
      model: "StructureBuildings",
      key: store.wireKeyOf("StructureBuildings", { game_id: 1, entity_id: 7 })!,
      value: { ...counts, packed_counts_3: (1n << 64n) | (1n << 88n) },
    },
  ] as never);
  expect(options(2).get(BuildingType.ConscriptionCamp)?.standing).toBe("built");
  expect(options(2).get(BuildingType.RationsDepot)?.standing).toBe("built");
});

it("opens one Storeroom a Realm at City", () => {
  const { store, realm } = realmBoard();
  const storeroom = (level: number) =>
    readBuildOptions(store, { ...realm, base: { ...realm.base, level } }, true, 350)!.find(
      ({ category }) => category === BuildingType.Storehouse,
    )!;
  expect(storeroom(0).standing).toEqual({ level: 1 });
  expect(storeroom(1).standing).toBe("open");
  const counts = store.require("StructureBuildings", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    {
      model: "StructureBuildings",
      key: store.wireKeyOf("StructureBuildings", { game_id: 1, entity_id: 7 })!,
      value: { ...counts, packed_counts_1: counts.packed_counts_1 | (1n << 8n) },
    },
  ] as never);
  expect(storeroom(1).standing).toBe("built");
});
