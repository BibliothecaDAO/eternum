import { buildablePlotCount } from "@bibliothecadao/eternum";
import { BUILDINGS_CENTER } from "@bibliothecadao/types";

const normalizeNonNegativeInteger = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

export const formatPopulationStatusLabel = (population: number, populationCapacity: number) =>
  `${normalizeNonNegativeInteger(population)}/${normalizeNonNegativeInteger(populationCapacity)}`;

export const formatUsedBuildingTilesLabel = (used: number, total: number) =>
  `${normalizeNonNegativeInteger(used)}/${normalizeNonNegativeInteger(total)}`;

export const countOccupiedBuildingTilesByStructure = ({
  buildings,
  trackedStructureIds,
}: {
  buildings: Array<{ structureId: number; innerCol: number; innerRow: number }>;
  trackedStructureIds: ReadonlySet<number>;
}) =>
  buildings.reduce<Record<number, number>>((counts, building) => {
    const structureId = normalizeNonNegativeInteger(building.structureId);
    if (!trackedStructureIds.has(structureId)) {
      return counts;
    }

    const innerCol = normalizeNonNegativeInteger(building.innerCol);
    const innerRow = normalizeNonNegativeInteger(building.innerRow);
    const isCenterKeepTile = innerCol === BUILDINGS_CENTER[0] && innerRow === BUILDINGS_CENTER[1];

    if (isCenterKeepTile) {
      return counts;
    }

    counts[structureId] = (counts[structureId] ?? 0) + 1;
    return counts;
  }, {});

export const resolveAvailableBuildingTiles = ({
  level,
  occupiedBuildingTiles,
}: {
  level: number;
  occupiedBuildingTiles: number;
}) => {
  const total = buildablePlotCount(normalizeNonNegativeInteger(level));
  const occupied = Math.min(normalizeNonNegativeInteger(occupiedBuildingTiles), total);

  return {
    available: total - occupied,
    occupied,
    total,
  };
};
