// @vitest-environment node

import { BuildingType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  buildBlitzRealmSuggestions,
  readBuildOrder,
  type BlitzArmyState,
  type BlitzBuildingCounts,
  type BlitzRealmSuggestionInput,
  type BuildOrder,
} from "@bibliothecadao/eternum/automation";

const buildability: BlitzRealmSuggestionInput["buildability"] = {
  copper: { canBuild: true, needsRoom: false },
  coal: { canBuild: true, needsRoom: false },
  military: { canBuild: true, needsRoom: false },
  wheat: { canBuild: true, needsRoom: false },
  wood: { canBuild: true, needsRoom: false },
  workerHut: { canBuild: true, needsRoom: false },
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
  army: null,
  buildability,
  ...overrides,
});

const counts = (built: Partial<BlitzBuildingCounts>) => ({ ...emptyCounts, ...built });

/** The realm's next step, as the panel and Next up read it: its action and its reason. */
const nextStep = (input: BlitzRealmSuggestionInput, order?: BuildOrder) =>
  buildBlitzRealmSuggestions(input, order).map(({ action, reason }) => `${action} · ${reason}`);

/** A player's order from its steps, as the language reads its JSON: [rank, goal, count]; a level up has no count. */
const order = (...steps: [rank: string, goal: string, count?: number][]): BuildOrder => {
  const read = readBuildOrder({ name: "Mine", steps: steps.map(([rank, goal, count]) => ({ rank, goal, count })) });
  if ("error" in read) throw new Error(read.error);
  return read.ok;
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

  it("levels up first whenever the realm can", () => {
    expect(nextStep(baseInput({ canAffordUpgrade: true, population: 9 }))).toEqual(["upgrade · It can level up now."]);
  });

  it("builds the next farm at population 9 of 12, where a farm needs 1: no worker hut it does not need", () => {
    expect(nextStep(baseInput({ population: 9, populationCapacity: 12 }))).toEqual([
      "build-wheat · Wheat farms: 0 of 2 built.",
    ]);
  });

  it("builds a worker hut only when the next step has no room, and says which step it makes room for", () => {
    const noRoomForWood = {
      ...buildability,
      wood: { canBuild: false, reason: "Need more population.", needsRoom: true },
    };
    expect(
      nextStep(
        baseInput({
          population: 11,
          populationCapacity: 12,
          buildingCounts: counts({ wheat: 4 }),
          buildability: noRoomForWood,
        }),
      ),
    ).toEqual(["build-worker-hut · Wood camps: 0 of 1 built. Population 11 of 12: a worker hut makes room."]);
    // A hut the realm cannot pay for yet holds the order, as any step does.
    const noHut = { ...noRoomForWood, workerHut: { canBuild: false, reason: "Needs 28 wood", needsRoom: false } };
    expect(nextStep(baseInput({ buildingCounts: counts({ wheat: 4 }), buildability: noHut }))).toEqual([]);
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
      troopType: TroopType.Knight,
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
    const noFarm = { ...buildability, wheat: { canBuild: false, reason: "Needs 30 wood", needsRoom: false } };
    expect(buildBlitzRealmSuggestions(baseInput({ buildability: noFarm }))).toEqual([]);
    expect(buildBlitzRealmSuggestions(baseInput({ hasAvailableBuildingTile: false }))).toEqual([]);
  });

  it("follows a player's own order instead, a level-up still first and a hut when its step needs room", () => {
    const coalRush = order(["City", "coal", 2], ["City", "farm", 4]);
    expect(nextStep(baseInput(), coalRush)).toEqual(["build-coal · Coal mines: 0 of 2 built."]);
    expect(nextStep(baseInput({ buildingCounts: counts({ coal: 2 }) }), coalRush)).toEqual([
      "build-wheat · Wheat farms: 0 of 4 built.",
    ]);
    const noRoomForCoal = { ...buildability, coal: { canBuild: false, needsRoom: true } };
    expect(nextStep(baseInput({ population: 10, buildability: noRoomForCoal }), coalRush)).toEqual([
      "build-worker-hut · Coal mines: 0 of 2 built. Population 10 of 10: a worker hut makes room.",
    ]);
    // Done with its order, the realm has no step.
    expect(nextStep(baseInput({ buildingCounts: counts({ coal: 2, wheat: 4 }) }), coalRush)).toEqual([]);
  });

  it("levels up first whenever it can, unless the order places the level up itself, which then waits its turn", () => {
    const canLevel = { canAffordUpgrade: true };
    // No level up in the order: it comes first.
    expect(nextStep(baseInput(canLevel), order(["City", "coal", 2]))).toEqual(["upgrade · It can level up now."]);
    // Placed after the coal: the coal first, then the level up.
    const coalThenLevel = order(["City", "coal", 2], ["City", "levelUp"], ["City", "farm", 4]);
    expect(nextStep(baseInput(canLevel), coalThenLevel)).toEqual(["build-coal · Coal mines: 0 of 2 built."]);
    const coalDone = { ...canLevel, buildingCounts: counts({ coal: 2 }) };
    expect(nextStep(baseInput(coalDone), coalThenLevel)).toEqual(["upgrade · It can level up now."]);
    // Not yet paid for, it holds the farms after it: the order saves for its level up.
    expect(nextStep(baseInput({ ...coalDone, canAffordUpgrade: false }), coalThenLevel)).toEqual([]);
    // Past that rank, its level up is done and the steps after it come.
    expect(nextStep(baseInput({ ...coalDone, realmLevel: 2, canAffordUpgrade: false }), coalThenLevel)).toEqual([
      "build-wheat · Wheat farms: 0 of 4 built.",
    ]);
  });
});

describe("a realm's first army on the default build order", () => {
  const knights = {
    buildingType: BuildingType.ResourceKnightT1,
    count: 1,
    label: "Knight T1",
    resource: ResourcesIds.Knight,
    troopType: TroopType.Knight,
  };
  const cityBuilt = counts({ wheat: 4, wood: 2, coal: 2, copper: 2, knightT1: 1 });
  const army = (state: Partial<BlitzArmyState>): BlitzArmyState => ({
    armies: 0,
    maxArmies: 3,
    troops: 0,
    fullArmy: 3_000,
    ...state,
  });
  const city = (state: Partial<BlitzArmyState>, overrides: Partial<BlitzRealmSuggestionInput> = {}) =>
    baseInput({ buildingCounts: cityBuilt, militaryTarget: knights, army: army(state), ...overrides });

  it("leaves the troops to production automation: short of a full army the order goes on, and deploys a full one", () => {
    // No Train step: the City's order is done with its barracks standing, and the Kingdom's next farm comes meanwhile.
    expect(nextStep(city({ troops: 400 }))).toEqual([]);
    expect(nextStep(city({ troops: 1_200 }, { realmLevel: 2 }))).toEqual(["build-wheat · Wheat farms: 4 of 8 built."]);
    expect(nextStep(city({ troops: 3_000 }))).toEqual([
      "deploy-army · Knight T1: 3,000 on hand, a full army of 3,000.",
    ]);
    // Deploy names its troops: the realm's own, a full army of them, for the deployment to open on.
    expect(buildBlitzRealmSuggestions(city({ troops: 3_000 }))[0]).toMatchObject({
      label: "Deploy an army",
      troops: { type: TroopType.Knight, tier: TroopTier.T1, count: 3_000 },
    });
  });

  it("has no army step once the army stands, or where no slot is free", () => {
    expect(nextStep(city({ armies: 1, troops: 3_000 }))).toEqual([]);
    expect(nextStep(city({ maxArmies: 0, troops: 3_000 }))).toEqual([]);
  });

  it("builds the barracks first in a player's order that asks for an army before one", () => {
    const armyFirst = order(["City", "army", 1], ["City", "farm", 4]);
    expect(
      nextStep(city({}, { buildingCounts: counts({}), militaryTarget: { ...knights, count: 0 } }), armyFirst),
    ).toEqual(["build-military · Knight T1 buildings: 0 of 1 built."]);
  });
});
