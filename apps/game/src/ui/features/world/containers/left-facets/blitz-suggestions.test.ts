// @vitest-environment node

import { BuildingType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  BUILD_ORDER_GOALS,
  buildBlitzRealmSuggestions,
  buildOrderTarget,
  readBuildOrder,
  type BlitzArmy,
  type BlitzArmyState,
  type BlitzBuildability,
  type BlitzRealmSuggestionInput,
  type BlitzTroop,
  type BuildOrder,
} from "@bibliothecadao/eternum/automation";

type Built = Partial<Record<BuildingType, number>>;
const counts =
  (built: Built = {}) =>
  (building: BuildingType) =>
    built[building] ?? 0;

const CAN: BlitzBuildability = { canBuild: true, needsRoom: false };
/** Every building buildable, but those named, which take the verdict given. */
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
const KNIGHT_T2: BlitzArmy = { type: TroopType.Knight, tier: TroopTier.T2 };
const PALADIN_T2: BlitzArmy = { type: TroopType.Paladin, tier: TroopTier.T2 };

/** A realm's armies: none yet, three slots, the troops on hand given, a full army of 3,000 at T1 and 1,000 above. */
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

/** The realm's next step, as the panel and Next up read it: its action and its reason. */
const nextStep = (input: BlitzRealmSuggestionInput, order?: BuildOrder) =>
  buildBlitzRealmSuggestions(input, order).map(({ action, reason }) => `${action} · ${reason}`);

/** A player's order from its steps, as the language reads its JSON: [rank, goal, count]; a level up has no count. */
const order = (...steps: [rank: string, goal: string, count?: number][]): BuildOrder => {
  const read = readBuildOrder({ name: "Mine", steps: steps.map(([rank, goal, count]) => ({ rank, goal, count })) });
  if ("error" in read) throw new Error(read.error);
  return read.ok;
};

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
    // A hut the realm cannot pay for yet holds the order, as any step does.
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

  it("levels up first whenever it can, unless the order places the level up itself, which then waits its turn", () => {
    const canLevel = { canAffordUpgrade: true };
    expect(nextStep(baseInput(canLevel), order(["City", "coal", 2]))).toEqual(["upgrade · It can level up now."]);
    const coalThenLevel = order(["City", "coal", 2], ["City", "levelUp"], ["City", "farm", 4]);
    expect(nextStep(baseInput(canLevel), coalThenLevel)).toEqual(["build · Coal: 0 of 2 built."]);
    const coalDone = { ...canLevel, built: counts({ [BuildingType.ResourceCoal]: 2 }) };
    expect(nextStep(baseInput(coalDone), coalThenLevel)).toEqual(["upgrade · It can level up now."]);
    expect(nextStep(baseInput({ ...coalDone, canAffordUpgrade: false }), coalThenLevel)).toEqual([]);
    expect(nextStep(baseInput({ ...coalDone, realmLevel: 2, canAffordUpgrade: false }), coalThenLevel)).toEqual([
      "build · Farm: 0 of 4 built.",
    ]);
  });
});

describe("a player's order of T2 and T3 steps", () => {
  const kingdom = (built: Built, overrides: Partial<BlitzRealmSuggestionInput> = {}) =>
    baseInput({ realmLevel: 2, built: counts(built), troop: KNIGHTS, ...overrides });
  const t2Rush = order(
    ["Kingdom", "ironwood", 1],
    ["Kingdom", "coldIron", 1],
    ["Kingdom", "paladinT2", 1],
    ["Kingdom", "adamantine", 1],
    ["Kingdom", "barracksT3", 1],
  );

  it("builds each tier's resources and troops by the construction window's own building", () => {
    expect(buildBlitzRealmSuggestions(kingdom({}), t2Rush)[0]).toMatchObject({
      action: "build",
      label: "Build Ironwood",
      reason: "Ironwood: 0 of 1 built.",
      buildingTypeHint: BuildingType.ResourceIronwood,
      resourceHint: ResourcesIds.Ironwood,
    });
    const ironwood = { [BuildingType.ResourceIronwood]: 1 };
    expect(nextStep(kingdom(ironwood), t2Rush)).toEqual(["build · Cold Iron: 0 of 1 built."]);
    const coldIron = { ...ironwood, [BuildingType.ResourceColdIron]: 1 };
    expect(buildBlitzRealmSuggestions(kingdom(coldIron), t2Rush)[0]).toMatchObject({
      reason: "Paladin T2: 0 of 1 built.",
      buildingTypeHint: BuildingType.ResourcePaladinT2,
      resourceHint: ResourcesIds.PaladinT2,
    });
    const paladins = { ...coldIron, [BuildingType.ResourcePaladinT2]: 1 };
    expect(nextStep(kingdom(paladins), t2Rush)).toEqual(["build · Adamantine: 0 of 1 built."]);
    const adamantine = { ...paladins, [BuildingType.ResourceAdamantine]: 1 };
    expect(buildBlitzRealmSuggestions(kingdom(adamantine), t2Rush)[0]).toMatchObject({
      reason: "Knight T3: 0 of 1 built.",
      buildingTypeHint: BuildingType.ResourceKnightT3,
    });
  });

  it("builds every building goal the language accepts, each by its own building", () => {
    const built = BUILD_ORDER_GOALS.flatMap((goal) => {
      const target = buildOrderTarget(goal);
      if (target.kind !== "building") return [];
      const [step] = buildBlitzRealmSuggestions(kingdom({}), order(["Kingdom", goal, 1]));
      return [[goal, step?.buildingTypeHint === target.building]];
    });
    expect(built).toHaveLength(21);
    expect(built.filter(([, ok]) => !ok)).toEqual([]);
  });

  it("holds on a T2 building the realm cannot pay for yet, as the construction rule judges its inputs", () => {
    const short = { [BuildingType.ResourceIronwood]: { canBuild: false, reason: "Needs 30 copper", needsRoom: false } };
    expect(nextStep(kingdom({}, { buildability: buildability(short) }), t2Rush)).toEqual([]);
  });

  it("deploys a T2 army of the biome troop once a full one is on hand, its barracks first", () => {
    const armyT2 = order(["Kingdom", "armyT2", 1]);
    expect(nextStep(kingdom({}), armyT2)).toEqual(["build · Knight T2: 0 of 1 built."]);
    const barracks = { [BuildingType.ResourceKnightT2]: 1 };
    expect(nextStep(kingdom(barracks, { army: army({ onHand: { [ResourcesIds.KnightT2]: 400 } }) }), armyT2)).toEqual(
      [],
    );
    const full = kingdom(barracks, { army: army({ onHand: { [ResourcesIds.KnightT2]: 1_000 } }) });
    expect(buildBlitzRealmSuggestions(full, armyT2)[0]).toMatchObject({
      action: "deploy-army",
      reason: "Knight T2: 1,000 on hand, a full army of 1,000.",
      troops: { type: TroopType.Knight, tier: TroopTier.T2, count: 1_000 },
    });
  });
});

describe("an army step of a tier, beside the realm's other armies", () => {
  const armyT2 = order(["Kingdom", "armyT2", 1]);
  const kingdom = (armies: BlitzArmy[], maxArmies = 3) =>
    baseInput({
      realmLevel: 2,
      built: counts({ [BuildingType.ResourceKnightT1]: 1, [BuildingType.ResourceKnightT2]: 1 }),
      troop: KNIGHTS,
      army: army({ armies, maxArmies, onHand: { [ResourcesIds.KnightT2]: 1_000 } }),
    });
  const deploysT2 = expect.objectContaining({
    action: "deploy-army",
    troops: { type: TroopType.Knight, tier: TroopTier.T2, count: 1_000 },
  });

  it("deploys its first T2 army though a T1 army already stands, and is met only once a T2 army of the troop stands", () => {
    expect(buildBlitzRealmSuggestions(kingdom([KNIGHT_T1]), armyT2)).toEqual([deploysT2]);
    expect(buildBlitzRealmSuggestions(kingdom([KNIGHT_T1, KNIGHT_T2]), armyT2)).toEqual([]);
  });

  it("is not met by another troop's army of the tier", () => {
    expect(buildBlitzRealmSuggestions(kingdom([PALADIN_T2]), armyT2)).toEqual([deploysT2]);
  });

  it("passes when every slot holds an army, whatever their troops", () => {
    expect(buildBlitzRealmSuggestions(kingdom([KNIGHT_T1, PALADIN_T2], 2), armyT2)).toEqual([]);
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

  it("has no army step once the army stands, or where no slot is free", () => {
    const standing = army({ armies: [KNIGHT_T1], onHand: { [ResourcesIds.Knight]: 3_000 } });
    expect(nextStep(city(3_000, { army: standing }))).toEqual([]);
    const noSlot = army({ maxArmies: 0, onHand: { [ResourcesIds.Knight]: 3_000 } });
    expect(nextStep(city(3_000, { army: noSlot }))).toEqual([]);
  });

  it("builds the barracks first in a player's order that asks for an army before one", () => {
    const armyFirst = order(["City", "army", 1], ["City", "farm", 4]);
    expect(nextStep(baseInput({ troop: KNIGHTS }), armyFirst)).toEqual(["build · Knight T1: 0 of 1 built."]);
  });
});
