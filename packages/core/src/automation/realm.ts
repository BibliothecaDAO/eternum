import {
  Biome,
  configManager,
  divideByPrecision,
  getBalance,
  getRealmInfo,
  getBuildingCount,
  getGuardsByStructure,
  getBlockTimestamp,
  type TileManager,
} from "../index";
import type { NativeFactStore } from "../client/index";
import { liveHomeArmies } from "../utils/expeditions";
import {
  type BiomeType,
  BuildingType,
  type ID,
  ResourcesIds,
  StructureType,
  TroopType,
  BUILDINGS_CENTER,
} from "@bibliothecadao/types";
import {
  buildBlitzRealmSuggestions,
  type BlitzBuildKey,
  type BlitzBuildingCounts,
  type BlitzMilitaryTarget,
  type BlitzRealmSuggestionInput,
  type BlitzSuggestionDraft,
} from "./blitz-suggestions";
import { resolveConstructionBuildability, type ConstructionBuildabilityInput } from "./construction";
import { generateBuildablePositions } from "./building-spots";
type RawUpgradeCost = { resource: number; amount: number };
type StaticBlitzBuildKey = Exclude<BlitzBuildKey, "military">;
type BuildabilityContext = {
  entityId: number;
  store: NativeFactStore;
  realm: ReturnType<typeof getRealmInfo>;
  mode?: ConstructionBuildabilityInput["mode"];
  useSimpleCost: boolean;
  hasAvailableBuildingTile: boolean;
};
const BLITZ_BUILDING_TYPES: Record<StaticBlitzBuildKey, BuildingType> = {
  copper: BuildingType.ResourceCopper,
  coal: BuildingType.ResourceCoal,
  wheat: BuildingType.ResourceWheat,
  wood: BuildingType.ResourceWood,
  workerHut: BuildingType.WorkersHut,
};

const T1_MILITARY_OPTIONS = [
  {
    troopType: TroopType.Crossbowman,
    buildingType: BuildingType.ResourceCrossbowmanT1,
    resource: ResourcesIds.Crossbowman,
    label: "Crossbowman T1",
    countKey: "crossbowmanT1",
  },
  {
    troopType: TroopType.Paladin,
    buildingType: BuildingType.ResourcePaladinT1,
    resource: ResourcesIds.Paladin,
    label: "Paladin T1",
    countKey: "paladinT1",
  },
  {
    troopType: TroopType.Knight,
    buildingType: BuildingType.ResourceKnightT1,
    resource: ResourcesIds.Knight,
    label: "Knight T1",
    countKey: "knightT1",
  },
] as const;

const resolveUpgradeCosts = (level: number): RawUpgradeCost[] =>
  (configManager.realmUpgradeCosts[level] as RawUpgradeCost[] | undefined) ?? [];

const canAffordRealmUpgrade = (realmId: ID, realmLevel: number, store: NativeFactStore, currentDefaultTick: number) => {
  const maxLevel = configManager.getMaxLevel(StructureType.Realm);
  const nextLevel = realmLevel + 1;
  if (realmLevel >= maxLevel || nextLevel > maxLevel) return false;

  const costs = resolveUpgradeCosts(nextLevel);
  if (costs.length === 0) return true;

  return costs.every((cost) => {
    const balance = getBalance(realmId, cost.resource, currentDefaultTick, store);
    return divideByPrecision(balance.balance) >= cost.amount;
  });
};

const resolveBuildabilityForBuilding = (context: BuildabilityContext, buildingType: BuildingType) => {
  const result = resolveConstructionBuildability({
    entityId: context.entityId,
    buildingType,
    useSimpleCost: context.useSimpleCost,
    store: context.store,
    realm: context.realm,
    mode: context.mode,
    hasAvailableBuildingTile: context.hasAvailableBuildingTile,
  });

  return {
    canBuild: result.canSubmit,
    reason: result.reason,
  };
};

const resolveStaticBuildability = (context: BuildabilityContext, key: StaticBlitzBuildKey) =>
  resolveBuildabilityForBuilding(context, BLITZ_BUILDING_TYPES[key]);

const resolveBlitzBuildability = (
  context: BuildabilityContext,
  militaryTarget: BlitzMilitaryTarget | null,
): BlitzRealmSuggestionInput["buildability"] => ({
  copper: resolveStaticBuildability(context, "copper"),
  coal: resolveStaticBuildability(context, "coal"),
  military: militaryTarget
    ? resolveBuildabilityForBuilding(context, militaryTarget.buildingType)
    : { canBuild: false, reason: "No biome military target." },
  wheat: resolveStaticBuildability(context, "wheat"),
  wood: resolveStaticBuildability(context, "wood"),
  workerHut: resolveStaticBuildability(context, "workerHut"),
});

const resolveRecommendedMilitaryTarget = (
  realm: ReturnType<typeof getRealmInfo> | null | undefined,
  buildingCounts: BlitzBuildingCounts,
): BlitzMilitaryTarget | null => {
  if (!realm?.position) return null;

  const realmBiome = Biome.getBiome(Number(realm.position.x), Number(realm.position.y)) as BiomeType;
  const best = T1_MILITARY_OPTIONS.map((option) => ({
    ...option,
    bonus: configManager.getBiomeCombatBonus(option.troopType, realmBiome),
  })).reduce<((typeof T1_MILITARY_OPTIONS)[number] & { bonus: number }) | null>((bestOption, option) => {
    if (!bestOption || option.bonus > bestOption.bonus) return option;
    return bestOption;
  }, null);

  if (!best || best.bonus <= 1) return null;

  return {
    buildingType: best.buildingType,
    count: buildingCounts[best.countKey],
    label: best.label,
    resource: best.resource,
    bonusPercent: Math.round((best.bonus - 1) * 100),
  };
};

export function readBlitzRealmSuggestions(input: {
  store: NativeFactStore;
  realmId: ID;
  realmName: string;
  isBlitzActive: boolean;
  tiles: Pick<TileManager, "isHexOccupied" | "existingBuildings">;
  mode?: ConstructionBuildabilityInput["mode"];
}): BlitzSuggestionDraft[] {
  const { store, realmId, realmName, isBlitzActive, tiles, mode } = input;
  const game_id = configManager.getActiveGameId();
  const structure = store.require("Structure", { game_id, entity_id: realmId });
  if (structure.base.category !== StructureType.Realm) return [];
  const buildings = store.require("StructureBuildings", { game_id, entity_id: realmId });
  const counts = [buildings.packed_counts_1, buildings.packed_counts_2, buildings.packed_counts_3];
  const count = (type: BuildingType) => getBuildingCount(type, counts);
  const buildingCounts: BlitzBuildingCounts = {
    wheat: count(BuildingType.ResourceWheat),
    wood: count(BuildingType.ResourceWood),
    coal: count(BuildingType.ResourceCoal),
    copper: count(BuildingType.ResourceCopper),
    workerHut: count(BuildingType.WorkersHut),
    crossbowmanT1: count(BuildingType.ResourceCrossbowmanT1),
    knightT1: count(BuildingType.ResourceKnightT1),
    paladinT1: count(BuildingType.ResourcePaladinT1),
  };
  // Suggestions weigh the realm itself; they never show its owner, so no player is named.
  const realm = getRealmInfo(realmId, store, () => null);
  const militaryTarget = resolveRecommendedMilitaryTarget(realm, buildingCounts);
  const hasAvailableBuildingTile = generateBuildablePositions(Math.max(1, structure.base.level + 1)).some(
    (spot) => (spot.col !== BUILDINGS_CENTER[0] || spot.row !== BUILDINGS_CENTER[1]) && !tiles.isHexOccupied(spot),
  );
  return buildBlitzRealmSuggestions({
    realmId,
    realmName,
    realmLevel: structure.base.level,
    isBlitzActive,
    canAffordUpgrade: canAffordRealmUpgrade(
      realmId,
      structure.base.level,
      store,
      getBlockTimestamp().currentDefaultTick,
    ),
    hasAvailableBuildingTile,
    buildingTilesOccupied: tiles.existingBuildings().length,
    buildingCounts,
    population: buildings.population.current,
    populationCapacity: buildings.population.max + configManager.getBasePopulationCapacity(),
    occupiedGuards: getGuardsByStructure(structure, store).filter((guard) => guard.troops.count > 0n).length,
    maxGuards: structure.base.troop_max_guard_count,
    occupiedExplorers: liveHomeArmies(store, realmId, game_id).length,
    maxExplorers: structure.base.troop_max_explorer_count,
    militaryTarget,
    buildability: resolveBlitzBuildability(
      { entityId: realmId, store, realm, mode, useSimpleCost: false, hasAvailableBuildingTile },
      militaryTarget,
    ),
  });
}
