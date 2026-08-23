import { BiomeType } from "@bibliothecadao/types";

import { findNearestTerrainHex, terrainCellKey, terrainHexToWorld } from "./terrain-coordinates";
import { TerrainField, type TerrainPropDensityContext } from "./terrain-field";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import type { TerrainPropArchetypeId } from "./terrain-prop-catalog";
import type { TerrainCellInput, TerrainPageRequest, TerrainPropInstance } from "./terrain-types";

interface WeightedArchetype {
  archetype: TerrainPropArchetypeId;
  weight: number;
}

interface BiomePropProfile {
  density: number;
  weights: readonly WeightedArchetype[];
}

interface TerrainPropPreparationContext {
  densityMultiplier: number;
  elevationSeed: number;
  field: TerrainField;
  moistureSeed: number;
  ownedByKey: ReadonlyMap<string, TerrainCellInput & { biome: BiomeType }>;
  pageKey: string;
}

const CANDIDATE_SPACING = 1;
export const PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER = 1.75;
const BIOME_PROP_PROFILES: Readonly<Record<BiomeType, BiomePropProfile>> = {
  [BiomeType.None]: profile(0),
  [BiomeType.DeepOcean]: profile(0),
  [BiomeType.Ocean]: profile(0),
  [BiomeType.Beach]: profile(0.14, ["palm", 5], ["boulder", 2], ["fallen-log", 1]),
  [BiomeType.Scorched]: profile(0.14, ["dead-tree", 4], ["boulder", 4], ["cactus", 1]),
  [BiomeType.Bare]: profile(0.17, ["boulder", 6], ["dead-tree", 2], ["stump", 1]),
  [BiomeType.Tundra]: profile(0.14, ["boulder", 5], ["conifer", 2], ["dead-tree", 1]),
  [BiomeType.Snow]: profile(0.12, ["boulder", 6], ["conifer", 2]),
  [BiomeType.TemperateDesert]: profile(0.18, ["cactus", 5], ["boulder", 3], ["shrub", 1]),
  [BiomeType.Shrubland]: profile(0.22, ["shrub", 6], ["boulder", 2], ["broadleaf", 1]),
  [BiomeType.Taiga]: profile(0.29, ["conifer", 6], ["birch", 3], ["dead-tree", 1], ["shrub", 2]),
  [BiomeType.Grassland]: profile(0.15, ["shrub", 5], ["broadleaf", 2], ["boulder", 1], ["stump", 1]),
  [BiomeType.TemperateDeciduousForest]: profile(0.31, ["broadleaf", 5], ["birch", 3], ["shrub", 2], ["stump", 1]),
  [BiomeType.TemperateRainForest]: profile(
    0.32,
    ["willow", 5],
    ["broadleaf", 4],
    ["birch", 1],
    ["shrub", 2],
    ["fallen-log", 1],
  ),
  [BiomeType.SubtropicalDesert]: profile(0.17, ["cactus", 5], ["shrub", 2], ["boulder", 3]),
  [BiomeType.TropicalSeasonalForest]: profile(0.3, ["palm", 4], ["broadleaf", 4], ["shrub", 2], ["fallen-log", 1]),
  [BiomeType.TropicalRainForest]: profile(
    0.34,
    ["willow", 4],
    ["palm", 3],
    ["broadleaf", 3],
    ["shrub", 2],
    ["fallen-log", 1],
  ),
};

export function prepareTerrainPropInstances(request: TerrainPageRequest, field: TerrainField): TerrainPropInstance[] {
  const ownedCells = request.cells.filter(
    (cell): cell is TerrainCellInput & { biome: BiomeType } => cell.biome !== null,
  );
  if (ownedCells.length === 0) return [];
  const ownedByKey = new Map(ownedCells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
  const bounds = resolveCandidateBounds(ownedCells);
  const elevationSeed = resolveSeed(request.climate.elevation_seed);
  const moistureSeed = resolveSeed(request.climate.moisture_seed);
  const densityMultiplier = resolveDensityMultiplier(request.propDensityMultiplier);
  const context = { densityMultiplier, elevationSeed, field, moistureSeed, ownedByKey, pageKey: request.pageKey };
  const instances: TerrainPropInstance[] = [];

  for (let latticeZ = bounds.minZ; latticeZ <= bounds.maxZ; latticeZ += 1) {
    for (let latticeX = bounds.minX; latticeX <= bounds.maxX; latticeX += 1) {
      const instance = prepareTerrainPropCandidate(latticeX, latticeZ, context);
      if (instance) instances.push(instance);
    }
  }

  return instances;
}

function prepareTerrainPropCandidate(
  latticeX: number,
  latticeZ: number,
  context: TerrainPropPreparationContext,
): TerrainPropInstance | null {
  const jitterX = hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, "prop-jitter-x-v1") - 0.5;
  const jitterZ = hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, "prop-jitter-z-v1") - 0.5;
  const worldX = (latticeX + jitterX * 0.72) * CANDIDATE_SPACING;
  const worldZ = (latticeZ + jitterZ * 0.72) * CANDIDATE_SPACING;
  const ownerCoordinate = findNearestTerrainHex(worldX, worldZ);
  const owner = context.ownedByKey.get(terrainCellKey(ownerCoordinate.col, ownerCoordinate.row));
  if (!owner || owner.occupied) return null;
  const propProfile = BIOME_PROP_PROFILES[owner.biome];
  if (propProfile.weights.length === 0) return null;

  const densityContext = context.field.samplePropDensityContext(worldX, worldZ, owner);
  const acceptance = hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, "prop-acceptance-v1");
  const densityUpperBound = resolveEffectiveTerrainPropDensity(
    owner.biome,
    densityContext,
    1,
    context.densityMultiplier,
  );
  if (acceptance >= densityUpperBound) return null;
  const surface = context.field.samplePropSurface(worldX, worldZ, owner);
  const effectiveDensity = resolveEffectiveTerrainPropDensity(
    owner.biome,
    densityContext,
    surface.normal[1],
    context.densityMultiplier,
  );
  if (acceptance >= effectiveDensity) return null;

  const archetype = chooseArchetype(
    propProfile.weights,
    hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, "prop-archetype-v1"),
  );
  if (!archetype) return null;
  return {
    archetype,
    ownerCol: owner.col,
    ownerRow: owner.row,
    pageKey: context.pageKey,
    scale: 0.82 + hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, "prop-scale-v1") * 0.34,
    worldX,
    worldY: surface.height,
    worldZ,
    yaw: hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, "prop-yaw-v1") * Math.PI * 2,
  };
}

export function resolveEffectiveTerrainPropDensity(
  ownerBiome: BiomeType,
  context: TerrainPropDensityContext,
  surfaceNormalY: number,
  densityMultiplier = 1,
): number {
  const blendedBiomeDensity = context.biomeInfluences.reduce(
    (density, influence) => density + BIOME_PROP_PROFILES[influence.biome].density * influence.weight,
    0,
  );
  const ownerInfluence = context.biomeInfluences.find(({ biome }) => biome === ownerBiome)?.weight ?? 0;
  const moistureResponse = 0.78 + smoothstep(0.18, 0.82, context.moisture) * 0.4;
  const elevationResponse = 1 - smoothstep(0.55, 0.9, context.elevation) * 0.18;
  const slopeResponse = 0.42 + smoothstep(0.94, 0.995, surfaceNormalY) * 0.58;
  const boundaryResponse = 0.86 + ownerInfluence * 0.14;
  const patchResponse = 0.72 + smoothstep(0.15, 0.85, context.patchiness) * 0.53;

  return clampUnit(
    blendedBiomeDensity *
      moistureResponse *
      elevationResponse *
      slopeResponse *
      boundaryResponse *
      patchResponse *
      context.clearance *
      densityMultiplier,
  );
}

function resolveDensityMultiplier(value: number | undefined): number {
  const multiplier = value ?? PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER;
  if (!Number.isFinite(multiplier) || multiplier < 0.25 || multiplier > 3) {
    throw new Error(`Terrain prop density multiplier must be from 0.25 to 3, received ${String(value)}`);
  }
  return multiplier;
}

function resolveCandidateBounds(cells: readonly TerrainCellInput[]) {
  const centers = cells.map((cell) => terrainHexToWorld(cell.col, cell.row));
  return {
    maxX: Math.ceil((Math.max(...centers.map(({ x }) => x)) + 1) / CANDIDATE_SPACING),
    maxZ: Math.ceil((Math.max(...centers.map(({ z }) => z)) + 1) / CANDIDATE_SPACING),
    minX: Math.floor((Math.min(...centers.map(({ x }) => x)) - 1) / CANDIDATE_SPACING),
    minZ: Math.floor((Math.min(...centers.map(({ z }) => z)) - 1) / CANDIDATE_SPACING),
  };
}

function chooseArchetype(weights: readonly WeightedArchetype[], value: number): TerrainPropArchetypeId | null {
  const totalWeight = weights.reduce((total, entry) => total + entry.weight, 0);
  let cursor = value * totalWeight;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.archetype;
  }
  return weights.at(-1)?.archetype ?? null;
}

function profile(density: number, ...weights: Array<readonly [TerrainPropArchetypeId, number]>): BiomePropProfile {
  return {
    density,
    weights: weights.map(([archetype, weight]) => ({ archetype, weight })),
  };
}

function hashUnit(col: number, row: number, elevationSeed: number, moistureSeed: number, salt: string): number {
  return terrainHashToUnitFloat(hashTerrainCoordinates({ col, elevationSeed, moistureSeed, row, salt }));
}

function resolveSeed(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? Math.trunc(value!) : 0;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clampUnit((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
