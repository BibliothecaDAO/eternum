import { terrainHexToWorld, terrainNeighborCoordinates } from "../terrain-coordinates";
import { TerrainField, type TerrainPropDensityContext } from "../terrain-field";
import { resolveTerrainSettlementInfluence } from "../terrain-settlements";
import type { TerrainCellInput, TerrainPageRequest } from "../terrain-types";
import { isTerrainWaterBiome } from "../terrain-water";

export interface TerrainEcologyTransectStats {
  roadCoreDisturbance: number;
  roadNaturalDisturbance: number;
  roadVergeSuccession: number;
  settlementCoreDisturbance: number;
  settlementEdgeSuccession: number;
  settlementOuterMaturity: number;
  settlementTierCount: number;
  wetlandEdgeStrength: number;
  wetlandInteriorStrength: number;
}

const EMPTY_TRANSECT_STATS: TerrainEcologyTransectStats = {
  roadCoreDisturbance: 0,
  roadNaturalDisturbance: 0,
  roadVergeSuccession: 0,
  settlementCoreDisturbance: 0,
  settlementEdgeSuccession: 0,
  settlementOuterMaturity: 0,
  settlementTierCount: 0,
  wetlandEdgeStrength: 0,
  wetlandInteriorStrength: 0,
};

export function measureTerrainEcologyTransects(request: TerrainPageRequest): TerrainEcologyTransectStats {
  const field = new TerrainField(request);
  return {
    ...EMPTY_TRANSECT_STATS,
    ...measureRoadTransect(request, field),
    ...measureSettlementTransect(request, field),
    ...measureWetlandTransect(request, field),
  };
}

function measureRoadTransect(request: TerrainPageRequest, field: TerrainField): Partial<TerrainEcologyTransectStats> {
  const segment = request.roadSegments[0];
  if (!segment) return {};
  const midpointX = (segment.start[0] + segment.end[0]) / 2;
  const midpointZ = (segment.start[1] + segment.end[1]) / 2;
  const deltaX = segment.end[0] - segment.start[0];
  const deltaZ = segment.end[1] - segment.start[1];
  const inverseLength = 1 / Math.max(Number.EPSILON, Math.hypot(deltaX, deltaZ));
  const normalX = -deltaZ * inverseLength;
  const normalZ = deltaX * inverseLength;
  const core = sampleTerrainEcology(request, field, midpointX, midpointZ);
  const verge = sampleTerrainEcology(request, field, midpointX + normalX * 0.82, midpointZ + normalZ * 0.82);
  const natural = sampleTerrainEcology(request, field, midpointX + normalX * 1.45, midpointZ + normalZ * 1.45);
  return {
    roadCoreDisturbance: core?.disturbanceStrength ?? 0,
    roadNaturalDisturbance: natural?.disturbanceStrength ?? 0,
    roadVergeSuccession: verge?.successionStrength ?? 0,
  };
}

function measureSettlementTransect(
  request: TerrainPageRequest,
  field: TerrainField,
): Partial<TerrainEcologyTransectStats> {
  const anchor = request.settlementAnchors[0];
  if (!anchor) return {};
  const center = terrainHexToWorld(anchor.col, anchor.row);
  const profile = resolveTerrainSettlementInfluence(anchor);
  const core = field.samplePropDensityContext(center.x, center.z, anchor);
  const edge = sampleTerrainEcology(request, field, center.x, center.z + 1.18 * profile.radiusScale);
  const outer = sampleTerrainEcology(request, field, center.x, center.z + 2.2 * profile.radiusScale);
  return {
    settlementCoreDisturbance: core.disturbanceStrength,
    settlementEdgeSuccession: edge?.successionStrength ?? 0,
    settlementOuterMaturity: outer?.maturity ?? 0,
    settlementTierCount: new Set(request.settlementAnchors.map(({ level }) => level)).size,
  };
}

function measureWetlandTransect(
  request: TerrainPageRequest,
  field: TerrainField,
): Partial<TerrainEcologyTransectStats> {
  const cellsByKey = new Map([...request.halo, ...request.cells].map((cell) => [`${cell.col}:${cell.row}`, cell]));
  const waterEdges: number[] = [];
  const interiors: number[] = [];
  for (const cell of request.cells) {
    if (!cell.explored || !cell.biome || isTerrainWaterBiome(cell.biome)) continue;
    const center = terrainHexToWorld(cell.col, cell.row);
    const waterNeighbors = terrainNeighborCoordinates(cell.col, cell.row)
      .map(({ col, row }) => cellsByKey.get(`${col}:${row}`))
      .filter((neighbor): neighbor is TerrainCellInput =>
        Boolean(neighbor?.biome && isTerrainWaterBiome(neighbor.biome)),
      );
    if (waterNeighbors.length === 0) {
      interiors.push(field.samplePropDensityContext(center.x, center.z, cell).waterEdgeStrength);
      continue;
    }
    for (const neighbor of waterNeighbors) {
      const water = terrainHexToWorld(neighbor.col, neighbor.row);
      waterEdges.push(
        field.samplePropDensityContext((center.x + water.x) / 2, (center.z + water.z) / 2, cell).waterEdgeStrength,
      );
    }
  }
  return {
    wetlandEdgeStrength: Math.max(0, ...waterEdges),
    wetlandInteriorStrength: interiors.length > 0 ? Math.min(...interiors) : 0,
  };
}

function sampleTerrainEcology(
  request: TerrainPageRequest,
  field: TerrainField,
  worldX: number,
  worldZ: number,
): TerrainPropDensityContext | null {
  let nearest: TerrainCellInput | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const cell of request.cells) {
    if (!cell.explored || !cell.biome || isTerrainWaterBiome(cell.biome)) continue;
    const center = terrainHexToWorld(cell.col, cell.row);
    const distance = (center.x - worldX) ** 2 + (center.z - worldZ) ** 2;
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  }
  return nearest ? field.samplePropDensityContext(worldX, worldZ, nearest) : null;
}
