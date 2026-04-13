import { StructureType, BUILDINGS_CENTER } from "@bibliothecadao/types";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";

const normalizeNonNegativeInteger = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

const normalizeOptionalNonNegativeInteger = (value: bigint | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = typeof value === "bigint" ? Number(value) : value;
  return Number.isFinite(normalizedValue) ? Math.max(0, Math.trunc(normalizedValue)) : null;
};

const resolveBuildRadius = (level: number) => normalizeNonNegativeInteger(level) + 1;

export const formatPopulationStatusLabel = (population: number, populationCapacity: number) =>
  `${normalizeNonNegativeInteger(population)}/${normalizeNonNegativeInteger(populationCapacity)}`;

export const formatAvailableBuildingTilesLabel = (available: number, total: number) =>
  `${normalizeNonNegativeInteger(available)}/${normalizeNonNegativeInteger(total)}`;

export const countOccupiedBuildingTilesByStructure = ({
  buildings,
  trackedStructureIds,
}: {
  buildings: Array<{ outerEntityId: number; innerCol: number; innerRow: number }>;
  trackedStructureIds: ReadonlySet<number>;
}) =>
  buildings.reduce<Record<number, number>>((counts, building) => {
    const outerEntityId = normalizeNonNegativeInteger(building.outerEntityId);
    if (!trackedStructureIds.has(outerEntityId)) {
      return counts;
    }

    const innerCol = normalizeNonNegativeInteger(building.innerCol);
    const innerRow = normalizeNonNegativeInteger(building.innerRow);
    const isCenterKeepTile = innerCol === BUILDINGS_CENTER[0] && innerRow === BUILDINGS_CENTER[1];

    if (isCenterKeepTile) {
      return counts;
    }

    counts[outerEntityId] = (counts[outerEntityId] ?? 0) + 1;
    return counts;
  }, {});

export const resolveAvailableBuildingTiles = ({
  level,
  occupiedBuildingTiles,
}: {
  level: number;
  occupiedBuildingTiles: number;
}) => {
  const radius = resolveBuildRadius(level);
  const total = 3 * radius * (radius + 1);
  const occupied = Math.min(normalizeNonNegativeInteger(occupiedBuildingTiles), total);

  return {
    available: total - occupied,
    occupied,
    total,
  };
};

type StructureBuildingsLike = {
  population?: {
    current?: bigint | number | null;
    max?: bigint | number | null;
  } | null;
} | null;

export type StructureStatusSnapshot = {
  populationCurrent: number | null;
  populationCapacityRaw: number | null;
  populationCapacityTotal: number | null;
  populationLabel: string | null;
  buildingTilesAvailable: number | null;
  buildingTilesTotal: number | null;
  buildingTilesLabel: string | null;
  hasAuthoritativePopulation: boolean;
  hasAuthoritativeBuildingTiles: boolean;
};

const buildEmptyStructureStatusSnapshot = (): StructureStatusSnapshot => ({
  populationCurrent: null,
  populationCapacityRaw: null,
  populationCapacityTotal: null,
  populationLabel: null,
  buildingTilesAvailable: null,
  buildingTilesTotal: null,
  buildingTilesLabel: null,
  hasAuthoritativePopulation: false,
  hasAuthoritativeBuildingTiles: false,
});

export const resolveStructureStatusSnapshot = ({
  structureCategory,
  structureLevel,
  structureBuildings,
  occupiedBuildingTiles,
  basePopulationCapacity,
}: {
  structureCategory: StructureType | undefined;
  structureLevel: number;
  structureBuildings: StructureBuildingsLike | undefined;
  occupiedBuildingTiles: number | null | undefined;
  basePopulationCapacity: number;
}): StructureStatusSnapshot => {
  if (!resolveStructureUiCapabilities({ category: structureCategory }).hasPopulationDetails) {
    return buildEmptyStructureStatusSnapshot();
  }

  const populationCurrent = normalizeOptionalNonNegativeInteger(structureBuildings?.population?.current);
  const populationCapacityRaw = normalizeOptionalNonNegativeInteger(structureBuildings?.population?.max);
  const normalizedBasePopulationCapacity = normalizeNonNegativeInteger(basePopulationCapacity);
  const populationCapacityTotal =
    populationCapacityRaw === null ? null : populationCapacityRaw + normalizedBasePopulationCapacity;
  const hasAuthoritativePopulation = populationCurrent !== null && populationCapacityTotal !== null;

  const buildingTileSummary =
    occupiedBuildingTiles === null || occupiedBuildingTiles === undefined
      ? null
      : resolveAvailableBuildingTiles({
          level: structureLevel,
          occupiedBuildingTiles,
        });

  return {
    populationCurrent,
    populationCapacityRaw,
    populationCapacityTotal,
    populationLabel:
      hasAuthoritativePopulation && populationCapacityTotal !== null
        ? formatPopulationStatusLabel(populationCurrent, populationCapacityTotal)
        : null,
    buildingTilesAvailable: buildingTileSummary?.available ?? null,
    buildingTilesTotal: buildingTileSummary?.total ?? null,
    buildingTilesLabel: buildingTileSummary
      ? formatAvailableBuildingTilesLabel(buildingTileSummary.available, buildingTileSummary.total)
      : null,
    hasAuthoritativePopulation,
    hasAuthoritativeBuildingTiles: Boolean(buildingTileSummary),
  };
};
