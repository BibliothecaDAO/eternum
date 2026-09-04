import type { GameModeConfig } from "@/config/game-modes";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getBuildingCosts,
} from "@bibliothecadao/eternum";
import {
  BUILDINGS_CENTER,
  BuildingType,
  getNeighborHexes,
  getProducedResource,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { gameEntityKey } from "@/sync/game-scope";

type ConstructionSpot = {
  col: number;
  row: number;
};

type ConstructionRealm = {
  category?: StructureType | number | null;
  level?: number | bigint | null;
  resources?: Array<ResourcesIds | number>;
  population?: number | bigint | null;
  capacity?: number | bigint | null;
  hasCapacity?: boolean | null;
};

type ConstructionTileManager = {
  isHexOccupied?: (spot: ConstructionSpot) => boolean;
  getRealmLevel?: (entityId: number) => number | bigint;
};

type ConstructionMode = Pick<GameModeConfig, "rules">;

type ConstructionBuildabilityCode =
  | "missing_realm"
  | "invalid_structure"
  | "mode_excluded"
  | "center_tile"
  | "out_of_radius"
  | "occupied_tile"
  | "missing_cost"
  | "simple_cost_locked"
  | "insufficient_resources"
  | "insufficient_capacity"
  | "insufficient_population"
  | "invalid_resource_for_structure"
  | "realm_full";

type ConstructionBuildabilityResult = {
  canSubmit: boolean;
  code?: ConstructionBuildabilityCode;
  reason?: string;
};

export type ConstructionBuildabilityInput = {
  entityId: number;
  buildingType: BuildingType;
  useSimpleCost: boolean;
  components: any;
  realm?: ConstructionRealm | null;
  mode?: ConstructionMode | null;
  targetSpot?: ConstructionSpot | null;
  tileManager?: ConstructionTileManager | null;
  hasAvailableBuildingTile?: boolean;
};

type ResourceCost = {
  resource: ResourcesIds | number;
  amount: number;
};

type PopulationState = {
  current: number;
  max: number;
  hasCapacity: boolean | null;
};

type BuildingPopulationImpact = {
  cost: number;
  capacityGrant: number;
};

const RESOURCE_PRODUCER_BUILDINGS_REQUIRING_STRUCTURE_RESOURCE = new Set<BuildingType>([
  BuildingType.ResourceStone,
  BuildingType.ResourceCoal,
  BuildingType.ResourceWood,
  BuildingType.ResourceCopper,
  BuildingType.ResourceIronwood,
  BuildingType.ResourceObsidian,
  BuildingType.ResourceGold,
  BuildingType.ResourceSilver,
  BuildingType.ResourceMithral,
  BuildingType.ResourceAlchemicalSilver,
  BuildingType.ResourceColdIron,
  BuildingType.ResourceDeepCrystal,
  BuildingType.ResourceRuby,
  BuildingType.ResourceDiamonds,
  BuildingType.ResourceHartwood,
  BuildingType.ResourceIgnium,
  BuildingType.ResourceTwilightQuartz,
  BuildingType.ResourceTrueIce,
  BuildingType.ResourceAdamantine,
  BuildingType.ResourceSapphire,
  BuildingType.ResourceEtherealSilica,
  BuildingType.ResourceDragonhide,
  BuildingType.ResourceLabor,
  BuildingType.ResourceAncientFragment,
]);

const SIMPLE_COST_LOCKED_RESOURCE_BUILDINGS = new Set<BuildingType>([
  BuildingType.ResourceDragonhide,
  BuildingType.ResourceMithral,
  BuildingType.ResourceAdamantine,
]);

const fail = (code: ConstructionBuildabilityCode, reason: string): ConstructionBuildabilityResult => ({
  canSubmit: false,
  code,
  reason,
});

const pass = (): ConstructionBuildabilityResult => ({ canSubmit: true, reason: undefined });

const toConstructionSpotKey = ({ col, row }: ConstructionSpot): string => `${col},${row}`;

const isProductionStructure = (category: StructureType | number | null | undefined) =>
  category === StructureType.Realm || category === StructureType.Village || category === StructureType.Camp;

const isCenterSpot = (spot: ConstructionSpot) => spot.col === BUILDINGS_CENTER[0] && spot.row === BUILDINGS_CENTER[1];

const toNumber = (value: number | bigint | null | undefined): number => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
};

const normalizeResourceCosts = (buildingCosts: unknown): ResourceCost[] => {
  if (!buildingCosts) return [];
  if (typeof buildingCosts !== "object") return [];

  const values = Array.isArray(buildingCosts) ? buildingCosts : Object.values(buildingCosts);
  return values.filter((cost): cost is ResourceCost => Boolean(cost && typeof cost === "object"));
};

const resolveBuildingTypeKey = (buildingType: BuildingType) => BuildingType[buildingType] ?? String(buildingType);

const getMilitaryTier = (buildingType: BuildingType): number => {
  if (
    buildingType === BuildingType.ResourceCrossbowmanT1 ||
    buildingType === BuildingType.ResourcePaladinT1 ||
    buildingType === BuildingType.ResourceKnightT1
  ) {
    return 1;
  }

  if (
    buildingType === BuildingType.ResourceCrossbowmanT2 ||
    buildingType === BuildingType.ResourcePaladinT2 ||
    buildingType === BuildingType.ResourceKnightT2
  ) {
    return 2;
  }

  if (
    buildingType === BuildingType.ResourceCrossbowmanT3 ||
    buildingType === BuildingType.ResourcePaladinT3 ||
    buildingType === BuildingType.ResourceKnightT3
  ) {
    return 3;
  }

  return 0;
};

const isSimpleCostLockedBuilding = (buildingType: BuildingType, useSimpleCost: boolean) =>
  useSimpleCost && (SIMPLE_COST_LOCKED_RESOURCE_BUILDINGS.has(buildingType) || getMilitaryTier(buildingType) > 1);

const resolveConstructionRadius = (input: ConstructionBuildabilityInput): number => {
  const tileManagerLevel = input.tileManager?.getRealmLevel?.(input.entityId);
  const level = toNumber(tileManagerLevel ?? input.realm?.level);
  return Math.max(1, level + 1);
};

const resolveDistanceFromCenter = (targetSpot: ConstructionSpot, maxDistance: number): number | null => {
  if (isCenterSpot(targetSpot)) return 0;

  const start: ConstructionSpot = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };
  let frontier = [start];
  const seen = new Set([toConstructionSpotKey(start)]);

  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const nextFrontier: ConstructionSpot[] = [];

    for (const spot of frontier) {
      for (const neighbor of getNeighborHexes(spot.col, spot.row)) {
        const key = toConstructionSpotKey(neighbor);
        if (seen.has(key)) continue;
        if (neighbor.col === targetSpot.col && neighbor.row === targetSpot.row) {
          return distance;
        }

        seen.add(key);
        nextFrontier.push(neighbor);
      }
    }

    frontier = nextFrontier;
  }

  return null;
};

const validateMode = ({ buildingType, mode }: ConstructionBuildabilityInput) => {
  if (!mode) return pass();

  const buildingTypeKey = resolveBuildingTypeKey(buildingType);
  if (mode.rules.isBuildingTypeAllowed(buildingTypeKey)) return pass();

  return fail("mode_excluded", "This building is not available in the current game mode.");
};

const validateTargetSpot = (input: ConstructionBuildabilityInput) => {
  const { targetSpot } = input;
  if (!targetSpot) {
    if (input.hasAvailableBuildingTile === false) {
      return fail("realm_full", "No empty building tiles available.");
    }
    return pass();
  }

  if (isCenterSpot(targetSpot)) {
    return fail("center_tile", "Buildings cannot be placed on the center tile.");
  }

  const radius = resolveConstructionRadius(input);
  const distance = resolveDistanceFromCenter(targetSpot, radius);
  if (distance === null || distance > radius) {
    return fail("out_of_radius", "This tile is outside the current structure level radius.");
  }

  const isOccupied = input.tileManager?.isHexOccupied?.(targetSpot) ?? false;
  if (isOccupied) {
    return fail("occupied_tile", "This tile is already occupied.");
  }

  return pass();
};

const validateCosts = (input: ConstructionBuildabilityInput): ConstructionBuildabilityResult => {
  const buildingCosts = normalizeResourceCosts(
    getBuildingCosts(input.entityId, input.components, input.buildingType, input.useSimpleCost),
  );
  if (buildingCosts.length === 0) {
    return fail("missing_cost", "No construction cost is configured for this building.");
  }

  const { currentDefaultTick } = getBlockTimestamp();
  const hasResources = buildingCosts.every((resourceCost) => {
    const balance = getBalance(input.entityId, resourceCost.resource, currentDefaultTick, input.components);
    return divideByPrecision(balance.balance) >= resourceCost.amount;
  });

  if (!hasResources) {
    return fail("insufficient_resources", "Insufficient resources to build.");
  }

  return pass();
};

const resolveBuildingPopulationImpact = (buildingType: BuildingType): BuildingPopulationImpact => {
  const buildingConfig = configManager.getBuildingCategoryConfig(buildingType);
  return {
    cost: toNumber(buildingConfig?.population_cost),
    capacityGrant: toNumber(buildingConfig?.capacity_grant),
  };
};

const resolveRecsPopulationState = (
  input: ConstructionBuildabilityInput,
  basePopulationCapacity: number,
): PopulationState | null => {
  const structureBuildingsComponent = input.components?.StructureBuildings;
  if (!structureBuildingsComponent) return null;

  const structureBuildings = getComponentValue(structureBuildingsComponent, gameEntityKey([BigInt(input.entityId)]));
  const population = structureBuildings?.population;
  if (!population) return null;

  const current = toNumber(population.current);
  const max = toNumber(population.max);

  return {
    current,
    max,
    hasCapacity: max + basePopulationCapacity > current,
  };
};

const resolvePopulationState = (
  input: ConstructionBuildabilityInput,
  basePopulationCapacity: number,
): PopulationState => {
  const recsPopulationState = resolveRecsPopulationState(input, basePopulationCapacity);
  if (recsPopulationState) return recsPopulationState;

  const current = toNumber(input.realm?.population);
  const max = toNumber(input.realm?.capacity);

  return {
    current,
    max,
    hasCapacity: input.realm?.hasCapacity ?? (max + basePopulationCapacity > current ? true : null),
  };
};

const lacksAvailablePopulationCapacity = (population: PopulationState, impact: BuildingPopulationImpact): boolean =>
  population.hasCapacity === false && impact.cost > 0 && impact.capacityGrant <= 0;

const exceedsProjectedPopulationCapacity = (
  population: PopulationState,
  impact: BuildingPopulationImpact,
  basePopulationCapacity: number,
): boolean => population.current + impact.cost > population.max + impact.capacityGrant + basePopulationCapacity;

const validatePopulation = (input: ConstructionBuildabilityInput): ConstructionBuildabilityResult => {
  if (input.buildingType === BuildingType.WorkersHut) return pass();

  const basePopulationCapacity = toNumber(configManager.getBasePopulationCapacity());
  const population = resolvePopulationState(input, basePopulationCapacity);
  const impact = resolveBuildingPopulationImpact(input.buildingType);

  if (lacksAvailablePopulationCapacity(population, impact)) {
    return fail("insufficient_capacity", "Need more capacity.");
  }

  if (exceedsProjectedPopulationCapacity(population, impact, basePopulationCapacity)) {
    return fail("insufficient_population", "Need more population.");
  }

  return pass();
};

const validateStructureResource = ({ buildingType, realm }: ConstructionBuildabilityInput) => {
  if (!RESOURCE_PRODUCER_BUILDINGS_REQUIRING_STRUCTURE_RESOURCE.has(buildingType)) return pass();

  const producedResource = getProducedResource(buildingType);
  if (producedResource === undefined || producedResource === null) {
    return fail("invalid_resource_for_structure", "This structure cannot produce that resource.");
  }

  const realmResources = new Set(realm?.resources ?? []);
  if (realmResources.has(producedResource)) return pass();

  return fail("invalid_resource_for_structure", "This structure cannot produce that resource.");
};

export const resolveConstructionBuildability = (
  input: ConstructionBuildabilityInput,
): ConstructionBuildabilityResult => {
  if (!input.realm) {
    return fail("missing_realm", "Select a realm before building.");
  }

  if (!isProductionStructure(input.realm.category)) {
    return fail("invalid_structure", "Only realms, villages, and camps can construct buildings.");
  }

  const modeResult = validateMode(input);
  if (!modeResult.canSubmit) return modeResult;

  const targetResult = validateTargetSpot(input);
  if (!targetResult.canSubmit) return targetResult;

  if (isSimpleCostLockedBuilding(input.buildingType, input.useSimpleCost)) {
    return fail("simple_cost_locked", "Switch to Resource mode to create this building.");
  }

  const costResult = validateCosts(input);
  if (!costResult.canSubmit) return costResult;

  const populationResult = validatePopulation(input);
  if (!populationResult.canSubmit) return populationResult;

  const resourceResult = validateStructureResource(input);
  if (!resourceResult.canSubmit) return resourceResult;

  return pass();
};
