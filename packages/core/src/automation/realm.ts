import { buildableRadius } from "../utils/castle-reach";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getRealmInfo,
  getBuildingCount,
  liveHomeArmies,
  storedBiomeAt,
  type TileManager,
} from "../index";
import type { NativeFactStore, NativeRows } from "../client/index";
import {
  BuildingType,
  type ID,
  ResourcesIds,
  StructureType,
  TroopTier,
  TroopType,
  BUILDINGS_CENTER,
} from "@bibliothecadao/types";
import {
  buildBlitzRealmSuggestions,
  type BlitzArmyState,
  type BlitzBuildKey,
  type BlitzBuildingCounts,
  type BlitzMilitaryTarget,
  type BlitzRealmSuggestionInput,
  type BlitzSuggestionDraft,
} from "./blitz-suggestions";
import {
  hasPopulationRoomFor,
  resolveConstructionBuildability,
  type ConstructionBuildabilityInput,
} from "./construction";
import { generateBuildablePositions } from "./building-spots";
import type { BuildOrder } from "./build-order";
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

const canAffordRealmUpgrade = (realmId: ID, realmLevel: number, store: NativeFactStore, currentDefaultTick: number) => {
  const maxLevel = configManager.getMaxLevel(StructureType.Realm);
  const nextLevel = realmLevel + 1;
  if (realmLevel >= maxLevel || nextLevel > maxLevel) return false;

  // A level this game has no recipe for is never affordable.
  const costs = configManager.getRealmUpgradeCosts(nextLevel);
  if (!costs) return false;

  return costs.every((cost) => {
    const { balance } = getBalance(realmId, cost.resource, currentDefaultTick, store);
    return balance !== undefined && divideByPrecision(balance) >= cost.amount;
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
    needsRoom: !hasPopulationRoomFor({ entityId: context.entityId, buildingType, store: context.store }),
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
    : { canBuild: false, reason: "No biome military target.", needsRoom: false },
  wheat: resolveStaticBuildability(context, "wheat"),
  wood: resolveStaticBuildability(context, "wood"),
  workerHut: resolveStaticBuildability(context, "workerHut"),
});

const resolveRecommendedMilitaryTarget = (
  store: NativeFactStore,
  realm: ReturnType<typeof getRealmInfo> | null | undefined,
  buildingCounts: BlitzBuildingCounts,
): BlitzMilitaryTarget | null => {
  if (!realm?.position) return null;

  const realmBiome = storedBiomeAt(store, false, Number(realm.position.x), Number(realm.position.y));
  if (!realmBiome) return null;
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
    troopType: best.troopType,
    resource: best.resource,
    bonusPercent: Math.round((best.bonus - 1) * 100),
  };
};

/**
 * The realm's field armies of its military target's troop, as Military counts them: living armies against its slots,
 * whole troops on hand at chain time and a full army at its level.
 */
const readBlitzArmyState = (
  store: NativeFactStore,
  structure: NativeRows["Structure"],
  militaryTarget: BlitzMilitaryTarget | null,
  tick: number,
): BlitzArmyState | null => {
  if (!militaryTarget) return null;
  const realmId = Number(structure.entity_id);
  const held = getBalance(realmId, militaryTarget.resource, tick, store).balance;
  return {
    armies: liveHomeArmies(store, realmId, structure.game_id).length,
    maxArmies: Number(structure.base.troop_max_explorer_count),
    troops: held === undefined ? 0 : Math.floor(divideByPrecision(Number(held), false)),
    fullArmy: configManager.getMaxArmySize(Number(structure.base.level), TroopTier.T1),
  };
};

export function readBlitzRealmSuggestions(input: {
  store: NativeFactStore;
  realmId: ID;
  realmName: string;
  isBlitzActive: boolean;
  tiles: Pick<TileManager, "isHexOccupied">;
  mode?: ConstructionBuildabilityInput["mode"];
  /** The default tick the upgrade's cost and the troops on hand are judged at. */
  tick: number;
  /** The order the player follows: their active one, or the default. */
  order: BuildOrder;
}): BlitzSuggestionDraft[] {
  const { store, realmId, realmName, isBlitzActive, tiles, mode, tick, order } = input;
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
  const militaryTarget = resolveRecommendedMilitaryTarget(store, realm, buildingCounts);
  const hasAvailableBuildingTile = generateBuildablePositions(buildableRadius(structure.base.level)).some(
    (spot) => (spot.col !== BUILDINGS_CENTER[0] || spot.row !== BUILDINGS_CENTER[1]) && !tiles.isHexOccupied(spot),
  );
  return buildBlitzRealmSuggestions(
    {
      realmId,
      realmName,
      realmLevel: structure.base.level,
      isBlitzActive,
      canAffordUpgrade: canAffordRealmUpgrade(realmId, structure.base.level, store, tick),
      hasAvailableBuildingTile,
      buildingCounts,
      population: buildings.population.current,
      populationCapacity: buildings.population.max + configManager.getBasePopulationCapacity(),
      militaryTarget,
      army: readBlitzArmyState(store, structure, militaryTarget, tick),
      buildability: resolveBlitzBuildability(
        { entityId: realmId, store, realm, mode, useSimpleCost: false, hasAvailableBuildingTile },
        militaryTarget,
      ),
    },
    order,
  );
}
