// @vitest-environment jsdom
import { expect, it } from "vitest";

const { ResourceManager } = await import("@bibliothecadao/eternum");
const { BuildingType, ResourcesIds } = await import("@bibliothecadao/types");
const { dayEndScenario } = await import("@/lab/game/day-end-scenario");
const { readBuildOptions } = await import("../build/build-options");
const { buildingsMake, outputBasis, outputLine, storeMakerLines } = await import("./store-makers");

/**
 * Nexonik's realm on prod (reports/frontier-production-rate-1.md) as the lab's day-end game holds it, at Frontier's
 * rates: three Workshops with Tools twice, three Farms with Fields, two Barracks with Drill, and the castle's labor.
 */
const realm = () => {
  const { store } = dayEndScenario();
  return { store, row: store.require("Structure", { game_id: 1, entity_id: 7 }) };
};

it("says on a store's card what makes its rate, the buildings and the castle, so the parts add up to it", () => {
  const { store, row } = realm();
  expect(storeMakerLines(store, row, ResourcesIds.Labor)).toEqual([
    "3 Workshops · +5/min each (3.4 + 50% Tools)",
    "Castle · +1.7/min",
  ]);
  expect(storeMakerLines(store, row, ResourcesIds.Wheat)).toEqual(["3 Farms · +6.3/min each (5 + 25% Fields)"]);
  expect(storeMakerLines(store, row, ResourcesIds.Knight)).toEqual(["2 Barracks · +2.1/min each (1.7 + 25% Drill)"]);
  // 3 × 5.04 + 1.68 = 16.8 labor a minute: the rate the chain stores and the card's "+17/min".
  const stored = new ResourceManager(store, 7).current(ResourcesIds.Labor)!.production!.production_rate;
  expect((Number(stored) / 1e9) * 60).toBeCloseTo(3 * 3.36 * 1.5 + 1.68, 6);
});

it("writes a building's output on its build card with what research adds, never the boosted figure as its base", () => {
  const { store, row } = realm();
  const farm = readBuildOptions(store, row, false, 0)!.find(
    (option) => option.category === BuildingType.ResourceWheat,
  )!;
  if (farm.effect.kind !== "produces") throw new Error("A Farm produces");
  expect(outputLine(farm.effect.output, farm.effect.research)).toBe("+6.3/min (5 + 25% Fields)");
  expect(outputBasis(farm.effect.output, farm.effect.research)).toBe("5 + 25% Fields");
  // With no pick taken, the rate is its base and says nothing more.
  expect(outputBasis(farm.effect.output, undefined)).toBeUndefined();
  expect(outputLine({ base: 0.084, total: 0.084 }, undefined)).toBe("+5/min");
});

it("says only what is known of a store's makers until the realm's research arrives, then what each makes", () => {
  const { store, row } = realm();
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  // The knowledge row is not in yet (the day-end fixture keeps it under 0xd).
  store.applyFacts([{ model: "RealmKnowledge", key: "0xd", value: null }] as never);
  expect(storeMakerLines(store, row, ResourcesIds.Labor)).toEqual(["3 Workshops", "Castle · +1.7/min"]);
  expect(storeMakerLines(store, row, ResourcesIds.Wheat)).toEqual(["3 Farms"]);
  // It arrives: each building's output, with what research adds.
  store.applyFacts([
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: { game_id: 1, structure_id: "7", learned: String(knowledge.learned) },
    },
  ] as never);
  expect(storeMakerLines(store, row, ResourcesIds.Labor)).toEqual([
    "3 Workshops · +5/min each (3.4 + 50% Tools)",
    "Castle · +1.7/min",
  ]);
});

it("says what all of a type's buildings make together for its card, and nothing until the realm's research arrives", () => {
  const { store, row } = realm();
  const farms = buildingsMake(store, row, BuildingType.ResourceWheat)!;
  // Three Farms at 5 wheat a minute with one Fields pick: 3 × 6.3, the one figure the card shows.
  expect(farms.perSecond * 60).toBeCloseTo(3 * 5.04 * 1.25, 6);
  expect(farms.research).toEqual({ side: "Fields", picks: 1, share: 0.25 });
  // Nothing a building type makes is stored for a War hall.
  expect(buildingsMake(store, row, BuildingType.WarHall)).toBeUndefined();
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  store.applyFacts([{ model: "RealmKnowledge", key: "0xd", value: null }] as never);
  expect(buildingsMake(store, row, BuildingType.ResourceWheat)).toBeUndefined();
  store.applyFacts([
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: { game_id: 1, structure_id: "7", learned: String(knowledge.learned) },
    },
  ] as never);
  expect(buildingsMake(store, row, BuildingType.ResourceWheat)!.perSecond * 60).toBeCloseTo(3 * 5.04 * 1.25, 6);
});
