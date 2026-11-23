// @vitest-environment node

import { BuildingType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  buildBlitzRealmSuggestions,
  type BlitzArmy,
  type BlitzArmyState,
  type BlitzBuildability,
  type BlitzRealmSuggestionInput,
  type BlitzTroop,
} from "@bibliothecadao/eternum/automation";

type Built = Partial<Record<BuildingType, number>>;
const counts =
  (built: Built = {}) =>
  (building: BuildingType) =>
    built[building] ?? 0;

const CAN: BlitzBuildability = { canBuild: true, needsRoom: false };
const buildability =
  (except: Partial<Record<BuildingType, BlitzBuildability>> = {}) =>
  (building: BuildingType) =>
    except[building] ?? CAN;

const KNIGHTS: BlitzTroop = {
  type: TroopType.Knight,
  tiers: {
    [TroopTier.T1]: { building: BuildingType.ResourceKnightT1, resource: ResourcesIds.Knight },
    [TroopTier.T2]: { building: BuildingType.ResourceKnightT2, resource: ResourcesIds.KnightT2 },
    [TroopTier.T3]: { building: BuildingType.ResourceKnightT3, resource: ResourcesIds.KnightT3 },
  },
};

const KNIGHT_T1: BlitzArmy = { type: TroopType.Knight, tier: TroopTier.T1 };
const PALADIN_T1: BlitzArmy = { type: TroopType.Paladin, tier: TroopTier.T1 };

const army = (
  state: { armies?: BlitzArmy[]; maxArmies?: number; onHand?: Partial<Record<ResourcesIds, number>> } = {},
) =>
  ({
    armies: state.armies ?? [],
    maxArmies: state.maxArmies ?? 3,
    troopsOnHand: (resource) => state.onHand?.[resource] ?? 0,
    fullArmy: (tier) => (tier === TroopTier.T1 ? 3_000 : 1_000),
  }) satisfies BlitzArmyState;

const baseInput = (overrides: Partial<BlitzRealmSuggestionInput> = {}): BlitzRealmSuggestionInput => ({
  realmId: 101,
  realmName: "Egonal",
  realmLevel: 1,
  isBlitzActive: true,
  canAffordUpgrade: false,
  hasAvailableBuildingTile: true,
  built: counts(),
  buildability: buildability(),
  population: 1,
  populationCapacity: 10,
  troop: null,
  army: army(),
  ...overrides,
});

const nextStep = (input: BlitzRealmSuggestionInput) =>
  buildBlitzRealmSuggestions(input).map(({ action, reason }) => `${action} · ${reason}`);

const CITY_DONE: Built = {
  [BuildingType.ResourceWheat]: 4,
  [BuildingType.ResourceWood]: 2,
  [BuildingType.ResourceCoal]: 2,
  [BuildingType.ResourceCopper]: 2,
};

describe("a realm's next step on the default build order", () => {
  it("offers nothing outside a running Blitz", () => {
    expect(buildBlitzRealmSuggestions(baseInput({ isBlitzActive: false }))).toEqual([]);
  });

  it("starts a Settlement on its two farms, built as the construction window builds them", () => {
    const [first] = buildBlitzRealmSuggestions(baseInput({ realmLevel: 0 }));
    expect(first).toMatchObject({
      action: "build",
      label: "Build Farm",
      reason: "Farm: 0 of 2 built.",
      buildingTypeHint: BuildingType.ResourceWheat,
      resourceHint: ResourcesIds.Wheat,
    });
  });

  it("levels up first whenever the realm can", () => {
    expect(nextStep(baseInput({ canAffordUpgrade: true, population: 9 }))).toEqual(["upgrade · It can level up now."]);
  });

  it("builds the next farm at population 9 of 12, where a farm needs 1: no worker hut it does not need", () => {
    expect(nextStep(baseInput({ population: 9, populationCapacity: 12 }))).toEqual(["build · Farm: 0 of 2 built."]);
  });

  it("builds a worker hut only when the next step has no room, and says which step it makes room for", () => {
    const noRoomForWood = { [BuildingType.ResourceWood]: { canBuild: false, needsRoom: true } };
    const farms = counts({ [BuildingType.ResourceWheat]: 4 });
    const [hut] = buildBlitzRealmSuggestions(
      baseInput({ population: 11, populationCapacity: 12, built: farms, buildability: buildability(noRoomForWood) }),
    );
    expect(hut).toMatchObject({
      action: "build",
      buildingTypeHint: BuildingType.WorkersHut,
      reason: "Wood: 0 of 1 built. Population 11 of 12: a worker hut makes room.",
    });
    const noHut = { ...noRoomForWood, [BuildingType.WorkersHut]: { canBuild: false, needsRoom: false } };
    expect(nextStep(baseInput({ built: farms, buildability: buildability(noHut) }))).toEqual([]);
  });

  it("raises a City's wood, coal and copper together once its four farms stand", () => {
    const wheat = BuildingType.ResourceWheat;
    expect(nextStep(baseInput({ built: counts({ [wheat]: 4 }) }))).toEqual(["build · Wood: 0 of 1 built."]);
    expect(nextStep(baseInput({ built: counts({ [wheat]: 4, [BuildingType.ResourceWood]: 1 }) }))).toEqual([
      "build · Coal: 0 of 1 built.",
    ]);
  });

  it("builds the realm's biome troop's T1 barracks last, and skips it where no troop has a biome edge", () => {
    expect(buildBlitzRealmSuggestions(baseInput({ built: counts(CITY_DONE), troop: KNIGHTS }))).toEqual([
      expect.objectContaining({
        action: "build",
        label: "Build Knight T1",
        reason: "Knight T1: 0 of 1 built.",
        buildingTypeHint: BuildingType.ResourceKnightT1,
        resourceHint: ResourcesIds.Knight,
      }),
    ]);
    expect(buildBlitzRealmSuggestions(baseInput({ built: counts(CITY_DONE), troop: null }))).toEqual([]);
  });

  it("offers a step only once it can be taken, and holds the steps after it: an order is a sequence", () => {
    const noFarm = { [BuildingType.ResourceWheat]: { canBuild: false, reason: "Needs 30 wood", needsRoom: false } };
    expect(buildBlitzRealmSuggestions(baseInput({ buildability: buildability(noFarm) }))).toEqual([]);
    expect(buildBlitzRealmSuggestions(baseInput({ hasAvailableBuildingTile: false }))).toEqual([]);
  });
});

describe("a realm's first army on the default build order", () => {
  const city = (onHand: number, overrides: Partial<BlitzRealmSuggestionInput> = {}) =>
    baseInput({
      built: counts({ ...CITY_DONE, [BuildingType.ResourceKnightT1]: 1 }),
      troop: KNIGHTS,
      army: army({ onHand: { [ResourcesIds.Knight]: onHand } }),
      ...overrides,
    });

  it("leaves the troops to production automation: short of a full army the order goes on, and deploys a full one", () => {
    expect(nextStep(city(400))).toEqual([]);
    expect(nextStep(city(1_200, { realmLevel: 2 }))).toEqual(["build · Farm: 4 of 8 built."]);
    expect(nextStep(city(3_000))).toEqual(["deploy-army · Knight T1: 3,000 on hand, a full army of 3,000."]);
    expect(buildBlitzRealmSuggestions(city(3_000))[0]).toMatchObject({
      label: "Deploy an army",
      troops: { type: TroopType.Knight, tier: TroopTier.T1, count: 3_000 },
    });
  });

  it("is not met by another troop's army, and stops once the army stands or no slot is free", () => {
    const other = army({ armies: [PALADIN_T1], onHand: { [ResourcesIds.Knight]: 3_000 } });
    expect(nextStep(city(3_000, { army: other }))).toEqual([
      "deploy-army · Knight T1: 3,000 on hand, a full army of 3,000.",
    ]);
    const standing = army({ armies: [KNIGHT_T1], onHand: { [ResourcesIds.Knight]: 3_000 } });
    expect(nextStep(city(3_000, { army: standing }))).toEqual([]);
    const noSlot = army({ maxArmies: 0, onHand: { [ResourcesIds.Knight]: 3_000 } });
    expect(nextStep(city(3_000, { army: noSlot }))).toEqual([]);
  });
});
