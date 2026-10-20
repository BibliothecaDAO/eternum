// @vitest-environment node

import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  buildBlitzRealmSuggestions,
  parseBuildOrder,
  type BlitzBuildingCounts,
  type BlitzRealmSuggestionInput,
  type BuildOrder,
} from "@bibliothecadao/eternum/automation";

const buildability: BlitzRealmSuggestionInput["buildability"] = {
  copper: { canBuild: true },
  coal: { canBuild: true },
  military: { canBuild: true },
  wheat: { canBuild: true },
  wood: { canBuild: true },
  workerHut: { canBuild: true },
};

const emptyCounts: BlitzBuildingCounts = {
  copper: 0,
  coal: 0,
  crossbowmanT1: 0,
  knightT1: 0,
  paladinT1: 0,
  wheat: 0,
  wood: 0,
  workerHut: 0,
};

const baseInput = (overrides: Partial<BlitzRealmSuggestionInput> = {}): BlitzRealmSuggestionInput => ({
  realmId: 101,
  realmName: "Egonal",
  realmLevel: 1,
  isBlitzActive: true,
  canAffordUpgrade: false,
  hasAvailableBuildingTile: true,
  buildingCounts: emptyCounts,
  population: 1,
  populationCapacity: 10,
  buildability,
  ...overrides,
});

const counts = (built: Partial<BlitzBuildingCounts>) => ({ ...emptyCounts, ...built });

/** The realm's next step, as the panel and Next up read it: its action and its reason. */
const nextStep = (input: BlitzRealmSuggestionInput, order?: BuildOrder) =>
  buildBlitzRealmSuggestions(input, order).map(({ action, reason }) => `${action} · ${reason}`);

const order = (text: string): BuildOrder => {
  const read = parseBuildOrder(text, "Mine");
  if ("error" in read) throw new Error(read.error.message);
  return read.order;
};

describe("a realm's next step on the default build order", () => {
  it("offers nothing outside a running Blitz", () => {
    expect(buildBlitzRealmSuggestions(baseInput({ isBlitzActive: false }))).toEqual([]);
  });

  it("starts a Settlement on its two farms, built as the construction window builds them", () => {
    const [first] = buildBlitzRealmSuggestions(baseInput({ realmLevel: 0 }));
    expect(first).toMatchObject({
      action: "build-wheat",
      reason: "Wheat farms: 0 of 2 built.",
      buildingTypeHint: BuildingType.ResourceWheat,
      resourceHint: ResourcesIds.Wheat,
    });
  });

  it("levels up first whenever the realm can, and builds a worker hut when population is 3 from full", () => {
    expect(nextStep(baseInput({ canAffordUpgrade: true, population: 9 }))).toEqual(["upgrade · It can level up now."]);
    expect(nextStep(baseInput({ population: 7, populationCapacity: 10 }))).toEqual([
      "build-worker-hut · Population 7 of 10: a worker hut makes room for more.",
    ]);
    // With room to spare, the order: a City with no farm yet starts on the Settlement's two.
    expect(nextStep(baseInput({ population: 6, populationCapacity: 10 }))).toEqual([
      "build-wheat · Wheat farms: 0 of 2 built.",
    ]);
  });

  it("raises a City's wood, coal and copper together once its four farms stand", () => {
    expect(nextStep(baseInput({ buildingCounts: counts({ wheat: 4 }) }))).toEqual([
      "build-wood · Wood camps: 0 of 1 built.",
    ]);
    expect(nextStep(baseInput({ buildingCounts: counts({ wheat: 4, wood: 1 }) }))).toEqual([
      "build-coal · Coal mines: 0 of 1 built.",
    ]);
    expect(nextStep(baseInput({ buildingCounts: counts({ wheat: 4, wood: 1, coal: 1, copper: 1 }) }))).toEqual([
      "build-wood · Wood camps: 1 of 2 built.",
    ]);
  });

  it("builds the realm's best T1 military for its biome last, and skips it where no troop has a biome edge", () => {
    const builtOut = counts({ wheat: 4, wood: 2, coal: 2, copper: 2 });
    const knights = {
      buildingType: BuildingType.ResourceKnightT1,
      count: 0,
      label: "Knight T1",
      resource: ResourcesIds.Knight,
    };
    expect(buildBlitzRealmSuggestions(baseInput({ buildingCounts: builtOut, militaryTarget: knights }))).toEqual([
      expect.objectContaining({
        action: "build-military",
        label: "Build Knight T1",
        reason: "Knight T1 buildings: 0 of 1 built.",
        buildingTypeHint: BuildingType.ResourceKnightT1,
      }),
    ]);
    expect(buildBlitzRealmSuggestions(baseInput({ buildingCounts: builtOut, militaryTarget: null }))).toEqual([]);
  });

  it("takes a Kingdom's farms to eight once the City's steps are done", () => {
    const cityDone = counts({ wheat: 4, wood: 2, coal: 2, copper: 2 });
    expect(nextStep(baseInput({ realmLevel: 2, buildingCounts: cityDone }))).toEqual([
      "build-wheat · Wheat farms: 4 of 8 built.",
    ]);
  });

  it("offers a step only once it can be taken, and holds the steps after it: an order is a sequence", () => {
    const noFarm = { ...buildability, wheat: { canBuild: false, reason: "Needs 30 wood" } };
    expect(buildBlitzRealmSuggestions(baseInput({ buildability: noFarm }))).toEqual([]);
    expect(buildBlitzRealmSuggestions(baseInput({ hasAvailableBuildingTile: false }))).toEqual([]);
  });

  it("follows a player's own order instead, the two standing rules still first", () => {
    const coalRush = order("City:\n2 coal\n4 farm");
    expect(nextStep(baseInput(), coalRush)).toEqual(["build-coal · Coal mines: 0 of 2 built."]);
    expect(nextStep(baseInput({ buildingCounts: counts({ coal: 2 }) }), coalRush)).toEqual([
      "build-wheat · Wheat farms: 0 of 4 built.",
    ]);
    expect(nextStep(baseInput({ population: 8 }), coalRush)).toEqual([
      "build-worker-hut · Population 8 of 10: a worker hut makes room for more.",
    ]);
    // Done with its order, the realm has no step.
    expect(nextStep(baseInput({ buildingCounts: counts({ coal: 2, wheat: 4 }) }), coalRush)).toEqual([]);
  });
});
