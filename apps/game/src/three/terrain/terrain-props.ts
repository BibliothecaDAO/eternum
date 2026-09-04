import { BiomeType } from "@bibliothecadao/types";

import { findNearestTerrainHex, terrainCellKey, terrainHexToWorld } from "./terrain-coordinates";
import { TERRAIN_BIOME_ART_DIRECTIONS } from "./terrain-biome-art-direction";
import { TerrainField, type TerrainPropDensityContext } from "./terrain-field";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import { TERRAIN_BIOME_DESCRIPTORS } from "./terrain-palette";
import {
  getTerrainPropCanopyExclusionRadius,
  getTerrainPropDisturbanceAffinity,
  getTerrainPropPlacementLayer,
  getTerrainPropRole,
  getTerrainPropSuccessionAffinity,
  getTerrainPropWetlandAffinity,
  type TerrainPropArchetypeId,
  type TerrainPropPlacementLayer,
} from "./terrain-prop-catalog";
import type {
  TerrainCellInput,
  TerrainPageRequest,
  TerrainPropAppearance,
  TerrainPropInstance,
  TerrainSurfaceSample,
} from "./terrain-types";

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
  eligibleByKey: ReadonlyMap<string, TerrainCellInput & { biome: BiomeType }>;
  field: TerrainField;
  moistureSeed: number;
  ownedByKey: ReadonlyMap<string, TerrainCellInput & { biome: BiomeType }>;
  pageKey: string;
}

interface CandidateBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

interface PreparedTerrainPropCandidate extends TerrainPropInstance {
  latticeX: number;
  latticeZ: number;
  layer: TerrainPropPlacementLayer;
  ownerKey: string;
  priority: number;
}

interface TerrainPropCandidateSite {
  acceptance: number;
  layerWeights: readonly WeightedArchetype[];
  owner: TerrainCellInput & { biome: BiomeType };
  ownerKey: string;
  worldX: number;
  worldZ: number;
}

interface AcceptedTerrainPropSite {
  densityContext: TerrainPropDensityContext;
  surface: TerrainSurfaceSample;
}

const CANDIDATE_SPACING: Readonly<Record<TerrainPropPlacementLayer, number>> = Object.freeze({
  canopy: 1,
  debris: 1,
  groundcover: 0.5,
  understory: 1,
});
const CANOPY_BUCKET_SIZE = 1.25;
const CANOPY_HALO_LATTICE_CELLS = 1;
const TERRAIN_PROP_PLACEMENT_LAYERS = Object.freeze(["canopy", "understory", "debris", "groundcover"] as const);
export const PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER = 1.75;
const GROUND_COVER_DENSITY_RATIO = 0.06;
const BIOME_PROP_PROFILES: Readonly<Record<BiomeType, BiomePropProfile>> = {
  [BiomeType.None]: profile(0),
  [BiomeType.DeepOcean]: profile(0),
  [BiomeType.Ocean]: profile(0),
  [BiomeType.Beach]: profile(0.14, ["palm", 5], ["boulder", 2], ["fallen-log", 1], ["grass-tuft", 8], ["reed", 2]),
  [BiomeType.Scorched]: profile(
    0.14,
    ["dead-tree", 4],
    ["boulder", 4],
    ["cactus", 1],
    ["grass-tuft", 2],
    ["wildflower", 1],
  ),
  [BiomeType.Bare]: profile(0.17, ["boulder", 6], ["dead-tree", 2], ["stump", 1], ["grass-tuft", 2]),
  [BiomeType.Tundra]: profile(
    0.14,
    ["boulder", 5],
    ["conifer", 2],
    ["dead-tree", 1],
    ["grass-tuft", 5],
    ["wildflower", 1],
  ),
  [BiomeType.Snow]: profile(0.12, ["boulder", 6], ["conifer", 2], ["grass-tuft", 1]),
  [BiomeType.TemperateDesert]: profile(
    0.18,
    ["cactus", 5],
    ["boulder", 3],
    ["shrub", 1],
    ["grass-tuft", 4],
    ["wildflower", 1],
  ),
  [BiomeType.Shrubland]: profile(
    0.22,
    ["shrub", 6],
    ["boulder", 2],
    ["broadleaf", 1],
    ["grass-tuft", 8],
    ["wildflower", 3],
    ["fern", 1],
  ),
  [BiomeType.Taiga]: profile(
    0.29,
    ["conifer", 6],
    ["birch", 3],
    ["dead-tree", 1],
    ["shrub", 2],
    ["fern", 5],
    ["grass-tuft", 4],
  ),
  [BiomeType.Grassland]: profile(
    0.15,
    ["shrub", 5],
    ["broadleaf", 2],
    ["boulder", 1],
    ["stump", 1],
    ["grass-tuft", 12],
    ["wildflower", 4],
    ["reed", 2],
  ),
  [BiomeType.TemperateDeciduousForest]: profile(
    0.31,
    ["broadleaf", 5],
    ["birch", 3],
    ["shrub", 2],
    ["stump", 1],
    ["fern", 7],
    ["grass-tuft", 3],
    ["wildflower", 2],
    ["reed", 1],
  ),
  [BiomeType.TemperateRainForest]: profile(
    0.32,
    ["willow", 5],
    ["broadleaf", 4],
    ["birch", 1],
    ["shrub", 2],
    ["fallen-log", 1],
    ["fern", 8],
    ["grass-tuft", 2],
    ["reed", 3],
  ),
  [BiomeType.SubtropicalDesert]: profile(0.17, ["cactus", 5], ["shrub", 2], ["boulder", 3], ["grass-tuft", 3]),
  [BiomeType.TropicalSeasonalForest]: profile(
    0.3,
    ["palm", 4],
    ["broadleaf", 4],
    ["shrub", 2],
    ["fallen-log", 1],
    ["fern", 6],
    ["grass-tuft", 3],
    ["wildflower", 1],
    ["reed", 2],
  ),
  [BiomeType.TropicalRainForest]: profile(
    0.34,
    ["willow", 4],
    ["palm", 3],
    ["broadleaf", 3],
    ["shrub", 2],
    ["fallen-log", 1],
    ["fern", 8],
    ["grass-tuft", 2],
    ["wildflower", 1],
    ["reed", 3],
  ),
};
const MAX_PROFILE_DENSITY_BY_LAYER: Readonly<Record<TerrainPropPlacementLayer, number>> = Object.freeze(
  Object.fromEntries(
    TERRAIN_PROP_PLACEMENT_LAYERS.map((layer) => [
      layer,
      Math.max(...Object.values(BIOME_PROP_PROFILES).map((profile) => resolveLayerDensity(profile, layer))),
    ]),
  ) as Record<TerrainPropPlacementLayer, number>,
);

export function prepareTerrainPropInstances(request: TerrainPageRequest, field: TerrainField): TerrainPropInstance[] {
  const ownedCells = request.cells.filter(
    (cell): cell is TerrainCellInput & { biome: BiomeType } => cell.explored && cell.biome !== null,
  );
  if (ownedCells.length === 0) return [];
  const ownedByKey = new Map(ownedCells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
  const eligibleCells = [...request.halo, ...ownedCells].filter(
    (cell): cell is TerrainCellInput & { biome: BiomeType } => cell.explored && cell.biome !== null,
  );
  const eligibleByKey = new Map(eligibleCells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
  const elevationSeed = resolveSeed(request.climate.elevation_seed);
  const moistureSeed = resolveSeed(request.climate.moisture_seed);
  const densityMultiplier = resolveDensityMultiplier(request.propDensityMultiplier);
  const context = {
    densityMultiplier,
    elevationSeed,
    eligibleByKey,
    field,
    moistureSeed,
    ownedByKey,
    pageKey: request.pageKey,
  };
  return TERRAIN_PROP_PLACEMENT_LAYERS.flatMap((layer) => prepareTerrainPropLayer(layer, context))
    .map(toTerrainPropInstance)
    .toSorted(compareTerrainPropInstances);
}

function prepareTerrainPropLayer(
  layer: TerrainPropPlacementLayer,
  context: TerrainPropPreparationContext,
): PreparedTerrainPropCandidate[] {
  const spacing = CANDIDATE_SPACING[layer];
  const layerBounds = resolveCandidateBounds(Array.from(context.ownedByKey.values()), spacing);
  const bounds = layer === "canopy" ? expandCandidateBounds(layerBounds, CANOPY_HALO_LATTICE_CELLS) : layerBounds;
  const candidates: PreparedTerrainPropCandidate[] = [];
  for (let latticeZ = bounds.minZ; latticeZ <= bounds.maxZ; latticeZ += 1) {
    for (let latticeX = bounds.minX; latticeX <= bounds.maxX; latticeX += 1) {
      const candidate = prepareTerrainPropCandidate(latticeX, latticeZ, layer, spacing, context);
      if (candidate) candidates.push(candidate);
    }
  }
  const spaced = layer === "canopy" ? rejectOverlappingCanopies(candidates) : candidates;
  return spaced.filter(({ ownerKey }) => context.ownedByKey.has(ownerKey));
}

function prepareTerrainPropCandidate(
  latticeX: number,
  latticeZ: number,
  layer: TerrainPropPlacementLayer,
  spacing: number,
  context: TerrainPropPreparationContext,
): PreparedTerrainPropCandidate | null {
  const site = resolveTerrainPropCandidateSite(latticeX, latticeZ, layer, spacing, context);
  if (!site) return null;
  const accepted = resolveAcceptedTerrainPropSite(site, layer, context);
  if (!accepted) return null;
  return buildTerrainPropCandidate(latticeX, latticeZ, layer, site, accepted, context);
}

function resolveTerrainPropCandidateSite(
  latticeX: number,
  latticeZ: number,
  layer: TerrainPropPlacementLayer,
  spacing: number,
  context: TerrainPropPreparationContext,
): TerrainPropCandidateSite | null {
  const acceptance = hashUnit(
    latticeX,
    latticeZ,
    context.elevationSeed,
    context.moistureSeed,
    `prop-${layer}-acceptance-v2`,
  );
  if (acceptance >= resolveTerrainPropDensityUpperBound(layer, context.densityMultiplier)) return null;
  const jitterX = hashUnit(
    latticeX,
    latticeZ,
    context.elevationSeed,
    context.moistureSeed,
    `prop-${layer}-jitter-x-v2`,
  );
  const jitterZ = hashUnit(
    latticeX,
    latticeZ,
    context.elevationSeed,
    context.moistureSeed,
    `prop-${layer}-jitter-z-v2`,
  );
  const worldX = (latticeX + (jitterX - 0.5) * 0.72) * spacing;
  const worldZ = (latticeZ + (jitterZ - 0.5) * 0.72) * spacing;
  const ownerCoordinate = findNearestTerrainHex(worldX, worldZ);
  const ownerKey = terrainCellKey(ownerCoordinate.col, ownerCoordinate.row);
  const owner = context.eligibleByKey.get(ownerKey);
  if (!owner || owner.occupied) return null;
  const propProfile = BIOME_PROP_PROFILES[owner.biome];
  const layerWeights = propProfile.weights.filter(({ archetype }) => getTerrainPropPlacementLayer(archetype) === layer);
  if (layerWeights.length === 0) return null;
  return { acceptance, layerWeights, owner, ownerKey, worldX, worldZ };
}

function resolveAcceptedTerrainPropSite(
  site: TerrainPropCandidateSite,
  layer: TerrainPropPlacementLayer,
  context: TerrainPropPreparationContext,
): AcceptedTerrainPropSite | null {
  const densityContext = context.field.samplePropDensityContext(site.worldX, site.worldZ, site.owner);
  const densityUpperBound = resolveEffectiveTerrainPropDensity(
    site.owner.biome,
    densityContext,
    1,
    context.densityMultiplier,
    layer,
  );
  if (site.acceptance >= densityUpperBound) return null;
  const surface = context.field.samplePropSurface(site.worldX, site.worldZ, site.owner);
  const effectiveDensity = resolveEffectiveTerrainPropDensity(
    site.owner.biome,
    densityContext,
    surface.normal[1],
    context.densityMultiplier,
    layer,
  );
  return site.acceptance < effectiveDensity ? { densityContext, surface } : null;
}

function buildTerrainPropCandidate(
  latticeX: number,
  latticeZ: number,
  layer: TerrainPropPlacementLayer,
  site: TerrainPropCandidateSite,
  accepted: AcceptedTerrainPropSite,
  context: TerrainPropPreparationContext,
): PreparedTerrainPropCandidate | null {
  const archetype = chooseArchetype(
    resolveEcologicalWeights(site.owner.biome, site.layerWeights, accepted.densityContext),
    hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, `prop-${layer}-archetype-v2`),
  );
  if (!archetype) return null;
  const scaleValue = hashUnit(
    latticeX,
    latticeZ,
    context.elevationSeed,
    context.moistureSeed,
    `prop-${layer}-scale-v2`,
  );
  const tintValue = hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, `prop-${layer}-tint-v2`);
  return {
    appearance: resolveTerrainPropAppearance(archetype, tintValue, accepted.densityContext),
    archetype,
    ownerCol: site.owner.col,
    ownerRow: site.owner.row,
    ownerKey: site.ownerKey,
    pageKey: context.pageKey,
    latticeX,
    latticeZ,
    layer,
    priority: hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, `prop-${layer}-priority-v2`),
    scale: resolveTerrainPropScale(archetype, scaleValue, accepted.densityContext),
    worldX: site.worldX,
    worldY: accepted.surface.height,
    worldZ: site.worldZ,
    yaw:
      hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, `prop-${layer}-yaw-v2`) * Math.PI * 2,
  };
}

function resolveTerrainPropAppearance(
  archetype: TerrainPropArchetypeId,
  tintVariation: number,
  context: TerrainPropDensityContext,
): TerrainPropAppearance {
  const climate = resolveTerrainPropClimate(context.biomeInfluences);
  const snow = clampUnit(climate.snow * (0.75 + context.elevation * 0.25));
  const mossSupport =
    smoothstep(0.3, 0.8, context.moisture) * (0.25 + context.canopyCover * 0.5 + context.debrisCover * 0.25);

  return {
    moss: clampUnit(mossSupport * (1 - snow * 0.85)),
    snow,
    tint: resolveTerrainPropTint(archetype, tintVariation, context),
    windAmplitude: clampUnit(climate.windAmplitude),
  };
}

function resolveTerrainPropClimate(
  biomeInfluences: TerrainPropDensityContext["biomeInfluences"],
): Pick<TerrainPropAppearance, "snow" | "windAmplitude"> {
  return biomeInfluences.reduce(
    (presentation, influence) => {
      presentation.snow += TERRAIN_BIOME_DESCRIPTORS[influence.biome].snow * influence.weight;
      presentation.windAmplitude +=
        TERRAIN_BIOME_ART_DIRECTIONS[influence.biome].motion.windAmplitude * influence.weight;
      return presentation;
    },
    { snow: 0, windAmplitude: 0 },
  );
}

function rejectOverlappingCanopies(
  candidates: readonly PreparedTerrainPropCandidate[],
): PreparedTerrainPropCandidate[] {
  const buckets = bucketCanopyCandidates(candidates);
  return candidates.filter((candidate) => {
    const bucketX = Math.floor(candidate.worldX / CANOPY_BUCKET_SIZE);
    const bucketZ = Math.floor(candidate.worldZ / CANOPY_BUCKET_SIZE);
    for (let z = bucketZ - 1; z <= bucketZ + 1; z += 1) {
      for (let x = bucketX - 1; x <= bucketX + 1; x += 1) {
        const neighbors = buckets.get(`${x}:${z}`) ?? [];
        if (
          neighbors.some((neighbor) => hasCanopyPriority(neighbor, candidate) && canopiesOverlap(neighbor, candidate))
        ) {
          return false;
        }
      }
    }
    return true;
  });
}

function bucketCanopyCandidates(
  candidates: readonly PreparedTerrainPropCandidate[],
): Map<string, PreparedTerrainPropCandidate[]> {
  const buckets = new Map<string, PreparedTerrainPropCandidate[]>();
  for (const candidate of candidates) {
    const key = `${Math.floor(candidate.worldX / CANOPY_BUCKET_SIZE)}:${Math.floor(candidate.worldZ / CANOPY_BUCKET_SIZE)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(candidate);
    else buckets.set(key, [candidate]);
  }
  return buckets;
}

function hasCanopyPriority(candidate: PreparedTerrainPropCandidate, other: PreparedTerrainPropCandidate): boolean {
  if (candidate === other) return false;
  if (candidate.priority !== other.priority) return candidate.priority > other.priority;
  return (
    candidate.latticeZ < other.latticeZ ||
    (candidate.latticeZ === other.latticeZ && candidate.latticeX < other.latticeX)
  );
}

function canopiesOverlap(left: PreparedTerrainPropCandidate, right: PreparedTerrainPropCandidate): boolean {
  const minimumDistance =
    getTerrainPropCanopyExclusionRadius(left.archetype) * left.scale +
    getTerrainPropCanopyExclusionRadius(right.archetype) * right.scale;
  const deltaX = left.worldX - right.worldX;
  const deltaZ = left.worldZ - right.worldZ;
  return deltaX * deltaX + deltaZ * deltaZ < minimumDistance * minimumDistance;
}

function resolveEcologicalWeights(
  biome: BiomeType,
  weights: readonly WeightedArchetype[],
  vegetation: TerrainPropDensityContext,
): WeightedArchetype[] {
  const undergrowth = TERRAIN_BIOME_ART_DIRECTIONS[biome].ecology.undergrowth;
  return weights.map((entry) => ({
    ...entry,
    weight:
      entry.weight *
      (getTerrainPropRole(entry.archetype) === "understory"
        ? 0.72 + undergrowth * 0.72
        : getTerrainPropRole(entry.archetype) === "canopy"
          ? 1.08 - undergrowth * 0.18
          : 0.86 + undergrowth * 0.28) *
      resolveTerrainPropSuccessionWeight(entry.archetype, vegetation) *
      resolveTerrainPropDisturbanceWeight(entry.archetype, vegetation) *
      resolveTerrainPropWetlandWeight(entry.archetype, vegetation),
  }));
}

function resolveTerrainPropWetlandWeight(
  archetype: TerrainPropArchetypeId,
  vegetation: TerrainPropDensityContext,
): number {
  const affinity = getTerrainPropWetlandAffinity(archetype);
  const wetland = 1 + vegetation.waterEdgeStrength * (affinity * 1.5 - 0.4);
  const verge = 1 + vegetation.roadEdgeStrength * (getTerrainPropSuccessionAffinity(archetype) * 0.8 - 0.15);
  return wetland * verge;
}

function resolveTerrainPropDisturbanceWeight(
  archetype: TerrainPropArchetypeId,
  vegetation: TerrainPropDensityContext,
): number {
  const affinity = getTerrainPropDisturbanceAffinity(archetype);
  return 1 + vegetation.settlementEdgeStrength * (affinity * 1.35 - 0.3);
}

function resolveTerrainPropSuccessionWeight(
  archetype: TerrainPropArchetypeId,
  vegetation: TerrainPropDensityContext,
): number {
  const affinity = getTerrainPropSuccessionAffinity(archetype);
  const succession = 1 + vegetation.successionStrength * (affinity * 1.3 - 0.35);
  const maturity = 1 + vegetation.maturity * ((1 - affinity) * 0.45 - affinity * 0.1);
  return succession * maturity;
}

function resolveTerrainPropScale(
  archetype: TerrainPropArchetypeId,
  value: number,
  vegetation: TerrainPropDensityContext,
): number {
  const role = getTerrainPropRole(archetype);
  const layer = getTerrainPropPlacementLayer(archetype);
  const shapedValue = clampUnit(
    value +
      (layer === "canopy" ? vegetation.maturity * 0.5 - vegetation.successionStrength * 0.36 : 0) +
      (layer === "understory" ? vegetation.successionStrength * 0.22 - vegetation.maturity * 0.08 : 0) +
      (layer === "debris" ? vegetation.maturity * 0.18 + vegetation.settlementEdgeStrength * 0.14 : 0),
  );
  if (role === "canopy") return 0.76 + shapedValue * 0.48;
  if (role === "groundcover") return 0.72 + shapedValue * 0.5;
  if (role === "understory") return 0.54 + shapedValue * 0.42;
  return 0.68 + shapedValue * 0.44;
}

function resolveTerrainPropTint(
  archetype: TerrainPropArchetypeId,
  value: number,
  vegetation: TerrainPropDensityContext,
): readonly [number, number, number] {
  if (getTerrainPropRole(archetype) === "canopy") {
    return [0.9 + value * 0.08, 0.94 + value * 0.06, 0.88 + value * 0.1];
  }
  if (getTerrainPropRole(archetype) === "understory") {
    return [0.91 + value * 0.07, 0.95 + value * 0.05, 0.89 + value * 0.08];
  }
  if (getTerrainPropRole(archetype) === "groundcover") {
    const dryness = clampUnit(1 - vegetation.moisture + vegetation.disturbanceStrength * 0.35);
    const wetness = vegetation.waterEdgeStrength;
    if (archetype === "fern") return [0.72 + value * 0.08, 0.88 + value * 0.08, 0.68 + value * 0.08];
    if (archetype === "reed") return [0.82 + value * 0.08, 0.9 + value * 0.07, 0.62 + wetness * 0.12];
    if (archetype === "wildflower") return [0.9 + value * 0.08, 0.94 + value * 0.05, 0.82 + value * 0.12];
    return [0.8 + dryness * 0.12, 0.9 - dryness * 0.14 + value * 0.05, 0.68 - dryness * 0.08];
  }
  const neutral = 0.9 + value * 0.1;
  return [neutral, neutral, neutral];
}

export function resolveEffectiveTerrainPropDensity(
  ownerBiome: BiomeType,
  context: TerrainPropDensityContext,
  surfaceNormalY: number,
  densityMultiplier = 1,
  layer?: TerrainPropPlacementLayer,
): number {
  const blendedBiomeDensity = context.biomeInfluences.reduce(
    (density, influence) =>
      density + resolveLayerDensity(BIOME_PROP_PROFILES[influence.biome], layer) * influence.weight,
    0,
  );
  const ownerInfluence = context.biomeInfluences.find(({ biome }) => biome === ownerBiome)?.weight ?? 0;
  const moistureResponse = 0.78 + smoothstep(0.18, 0.82, context.moisture) * 0.4;
  const elevationResponse = 1 - smoothstep(0.55, 0.9, context.elevation) * 0.18;
  const slopeResponse = 0.42 + smoothstep(0.94, 0.995, surfaceNormalY) * 0.58;
  const boundaryResponse = 0.86 + ownerInfluence * 0.14;
  const patchResponse = 0.72 + smoothstep(0.15, 0.85, context.patchiness) * 0.53;
  const layerResponse = resolveLayerCoverageResponse(context, layer);

  return clampUnit(
    blendedBiomeDensity *
      moistureResponse *
      elevationResponse *
      slopeResponse *
      boundaryResponse *
      patchResponse *
      layerResponse *
      context.clearance *
      densityMultiplier,
  );
}

function resolveLayerDensity(profile: BiomePropProfile, layer: TerrainPropPlacementLayer | undefined): number {
  if (!layer) return profile.density;
  if (layer === "groundcover") {
    return profile.weights.some(({ archetype }) => getTerrainPropPlacementLayer(archetype) === "groundcover")
      ? profile.density * GROUND_COVER_DENSITY_RATIO
      : 0;
  }
  const structuralWeights = profile.weights.filter(
    ({ archetype }) => getTerrainPropPlacementLayer(archetype) !== "groundcover",
  );
  const totalWeight = structuralWeights.reduce((total, { weight }) => total + weight, 0);
  if (totalWeight === 0) return 0;
  const layerWeight = structuralWeights.reduce(
    (total, entry) => total + (getTerrainPropPlacementLayer(entry.archetype) === layer ? entry.weight : 0),
    0,
  );
  return profile.density * (layerWeight / totalWeight);
}

function resolveLayerCoverageResponse(
  context: TerrainPropDensityContext,
  layer: TerrainPropPlacementLayer | undefined,
): number {
  if (!layer) return 1;
  const coverage =
    layer === "canopy" ? context.canopyCover : layer === "understory" ? context.understoryCover : context.debrisCover;
  if (layer === "groundcover") {
    return (
      0.38 +
      context.understoryCover * 0.34 +
      context.successionStrength * 0.2 +
      context.roadEdgeStrength * 0.22 +
      context.waterEdgeStrength * 0.28
    );
  }
  const ecologyResponse =
    layer === "understory"
      ? 0.9 + context.successionStrength * 0.25
      : layer === "debris"
        ? 0.8 + context.maturity * 0.35
        : 1;
  return (0.48 + coverage * 0.58) * ecologyResponse;
}

function resolveTerrainPropDensityUpperBound(layer: TerrainPropPlacementLayer, densityMultiplier: number): number {
  const maximumEnvironmentResponse = 2.1;
  return clampUnit(MAX_PROFILE_DENSITY_BY_LAYER[layer] * maximumEnvironmentResponse * densityMultiplier);
}

function resolveDensityMultiplier(value: number | undefined): number {
  const multiplier = value ?? PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER;
  if (!Number.isFinite(multiplier) || multiplier < 0.25 || multiplier > 3) {
    throw new Error(`Terrain prop density multiplier must be from 0.25 to 3, received ${String(value)}`);
  }
  return multiplier;
}

function resolveCandidateBounds(cells: readonly TerrainCellInput[], spacing = 1): CandidateBounds {
  const centers = cells.map((cell) => terrainHexToWorld(cell.col, cell.row));
  return {
    maxX: Math.ceil((Math.max(...centers.map(({ x }) => x)) + 1) / spacing),
    maxZ: Math.ceil((Math.max(...centers.map(({ z }) => z)) + 1) / spacing),
    minX: Math.floor((Math.min(...centers.map(({ x }) => x)) - 1) / spacing),
    minZ: Math.floor((Math.min(...centers.map(({ z }) => z)) - 1) / spacing),
  };
}

function expandCandidateBounds(bounds: CandidateBounds, cells: number): CandidateBounds {
  return {
    maxX: bounds.maxX + cells,
    maxZ: bounds.maxZ + cells,
    minX: bounds.minX - cells,
    minZ: bounds.minZ - cells,
  };
}

function toTerrainPropInstance(candidate: PreparedTerrainPropCandidate): TerrainPropInstance {
  const { latticeX, latticeZ, layer, ownerKey, priority, ...instance } = candidate;
  void latticeX;
  void latticeZ;
  void layer;
  void ownerKey;
  void priority;
  return instance;
}

function compareTerrainPropInstances(left: TerrainPropInstance, right: TerrainPropInstance): number {
  return (
    left.worldZ - right.worldZ ||
    left.worldX - right.worldX ||
    left.archetype.localeCompare(right.archetype) ||
    left.ownerRow - right.ownerRow ||
    left.ownerCol - right.ownerCol
  );
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
