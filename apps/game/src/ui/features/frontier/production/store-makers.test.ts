// @vitest-environment jsdom
import { expect, it } from "vitest";

const { ResourceManager } = await import("@bibliothecadao/eternum");
const { BuildingType, ResourcesIds } = await import("@bibliothecadao/types");
const { dayEndScenario } = await import("@/lab/game/day-end-scenario");
const { readBuildOptions } = await import("../build/build-options");
const { outputWhy, storeMakerLines } = await import("./store-makers");

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
  expect(storeMakerLines(store, row, ResourcesIds.Labor)).toEqual(["3 Workshops · +15/min", "Castle · +2/min"]);
  expect(storeMakerLines(store, row, ResourcesIds.Wheat)).toEqual(["3 Farms · +19/min"]);
  expect(storeMakerLines(store, row, ResourcesIds.Knight)).toEqual(["2 Barracks · +4/min"]);
  // 3 × 5.04 + 1.68 = 16.8 labor a minute: the rate the chain stores and the card's "+17/min".
  const stored = new ResourceManager(store, 7).current(ResourcesIds.Labor)!.production!.production_rate;
  expect((Number(stored) / 1e9) * 60).toBeCloseTo(3 * 3.36 * 1.5 + 1.68, 6);
});

it("explains a build card's research bonus without a formula", () => {
  const { store, row } = realm();
  const farm = readBuildOptions(store, row, false, 0)!.find(
    (option) => option.category === BuildingType.ResourceWheat,
  )!;
  if (farm.effect.kind !== "produces") throw new Error("A Farm produces");
  expect(outputWhy(farm.effect.research)).toBe("+25% from Fields");
  // With no pick taken, the rate is its base and says nothing more.
  expect(outputWhy(undefined)).toBeUndefined();
});

it("says only what is known of a store's makers until the realm's research arrives, then their combined production", () => {
  const { store, row } = realm();
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  // The knowledge row is not in yet (the day-end fixture keeps it under 0xd).
  store.applyFacts([{ model: "RealmKnowledge", key: "0xd", value: null }] as never);
  expect(storeMakerLines(store, row, ResourcesIds.Labor)).toEqual(["3 Workshops", "Castle · +2/min"]);
  expect(storeMakerLines(store, row, ResourcesIds.Wheat)).toEqual(["3 Farms"]);
  // Once it arrives, the combined production includes the learned research.
  store.applyFacts([
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: { game_id: 1, structure_id: "7", learned: String(knowledge.learned) },
    },
  ] as never);
  expect(storeMakerLines(store, row, ResourcesIds.Labor)).toEqual(["3 Workshops · +15/min", "Castle · +2/min"]);
});
