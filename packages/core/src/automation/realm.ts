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
  type BuildingType,
  getBuildingFromResource,
  type ID,
  StructureType,
  TROOP_TIERS,
  TROOP_TYPES,
  type TroopType,
  BUILDINGS_CENTER,
} from "@bibliothecadao/types";
import { getTroopResourceId } from "../utils/army";
import {
  buildBlitzRealmSuggestions,
  type BlitzArmyState,
  type BlitzBuildability,
  type BlitzRealmSuggestionInput,
  type BlitzSuggestionDraft,
  type BlitzTroop,
} from "./blitz-suggestions";
import {
  hasPopulationRoomFor,
  resolveConstructionBuildability,
  type ConstructionBuildabilityInput,
} from "./construction";
import { generateBuildablePositions } from "./building-spots";
import type { BuildOrder } from "./build-order";

type BuildabilityContext = {
  entityId: number;
  store: NativeFactStore;
  realm: ReturnType<typeof getRealmInfo>;
  mode?: ConstructionBuildabilityInput["mode"];
  useSimpleCost: boolean;
  hasAvailableBuildingTile: boolean;
};

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

/** A building's buildability, as the construction window judges it, asked for only by the step that needs it. */
const resolveBuildability = (context: BuildabilityContext, buildingType: BuildingType): BlitzBuildability => {
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

/** A troop at each tier: the building that trains it and the troops it trains. */
const troopTiers = (type: TroopType): BlitzTroop["tiers"] =>
  Object.fromEntries(
    TROOP_TIERS.map((tier) => {
      const resource = getTroopResourceId(type, tier);
      return [tier, { building: getBuildingFromResource(resource), resource }];
    }),
  ) as BlitzTroop["tiers"];

/** The troop the realm's biome favours most, if any troop has an edge there. */
const resolveBiomeTroop = (
  store: NativeFactStore,
  realm: ReturnType<typeof getRealmInfo> | null | undefined,
): BlitzTroop | null => {
  if (!realm?.position) return null;
  const realmBiome = storedBiomeAt(store, false, Number(realm.position.x), Number(realm.position.y));
  if (!realmBiome) return null;
  const best = TROOP_TYPES.map((type) => ({ type, bonus: configManager.getBiomeCombatBonus(type, realmBiome) })).reduce(
    (bestTroop, troop) => (troop.bonus > bestTroop.bonus ? troop : bestTroop),
  );
  if (best.bonus <= 1) return null;
  return { type: best.type, tiers: troopTiers(best.type) };
};

/**
 * The realm's field armies, as Military counts them: each living army's troop and tier against its slots, whole troops
 * on hand at chain time and a full army at its level.
 */
const readBlitzArmyState = (
  store: NativeFactStore,
  structure: NativeRows["Structure"],
  tick: number,
): BlitzArmyState => {
  const realmId = Number(structure.entity_id);
  const level = Number(structure.base.level);
  return {
    armies: liveHomeArmies(store, realmId, structure.game_id).map(({ troops }) => ({
      type: troops.category,
      tier: troops.tier,
    })),
    maxArmies: Number(structure.base.troop_max_explorer_count),
    troopsOnHand: (resource) => {
      const held = getBalance(realmId, resource, tick, store).balance;
      return held === undefined ? 0 : Math.floor(divideByPrecision(Number(held), false));
    },
    fullArmy: (tier) => configManager.getMaxArmySize(level, tier),
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
  // Suggestions weigh the realm itself; they never show its owner, so no player is named.
  const realm = getRealmInfo(realmId, store, () => null);
  const hasAvailableBuildingTile = generateBuildablePositions(buildableRadius(structure.base.level)).some(
    (spot) => (spot.col !== BUILDINGS_CENTER[0] || spot.row !== BUILDINGS_CENTER[1]) && !tiles.isHexOccupied(spot),
  );
  const context = { entityId: realmId, store, realm, mode, useSimpleCost: false, hasAvailableBuildingTile };
  return buildBlitzRealmSuggestions(
    {
      realmId,
      realmName,
      realmLevel: structure.base.level,
      isBlitzActive,
      canAffordUpgrade: canAffordRealmUpgrade(realmId, structure.base.level, store, tick),
      hasAvailableBuildingTile,
      built: (building) => getBuildingCount(building, counts),
      buildability: (building) => resolveBuildability(context, building),
      population: buildings.population.current,
      populationCapacity: buildings.population.max + configManager.getBasePopulationCapacity(),
      troop: resolveBiomeTroop(store, realm),
      army: readBlitzArmyState(store, structure, tick),
    } satisfies BlitzRealmSuggestionInput,
    order,
  );
}
