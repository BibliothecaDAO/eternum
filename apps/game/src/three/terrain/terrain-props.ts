import { isEtherealTerrainCell } from "./terrain-surface-presentation";
import { BiomeType } from "@bibliothecadao/types/terrain";

import {
  findNearestTerrainHex,
  terrainCellKey,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "./terrain-coordinates";
import {
  EVERY_LAYER_BIOME,
  LAYER_BIOMES,
  LAYER_BIOME_LOOKS,
  layerBiomeAt,
  type LayerBiome,
  type PersonalLayer,
} from "./layer-biomes";
import { isTerrainArmySpaceClear, TERRAIN_ARMY_ROUTE_HALF_WIDTH } from "./terrain-army-clearance";
import { isTerrainPropFootprintClear } from "./terrain-prop-footprint";
import { TERRAIN_BIOME_ART_DIRECTIONS } from "./terrain-biome-art-direction";
import { TerrainField, type TerrainPropDensityContext } from "./terrain-field";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import { TERRAIN_BIOME_DESCRIPTORS } from "./terrain-palette";
import {
  getLayerPropAnchor,
  getTerrainPropFootprintRadius,
  getTerrainPropSpacingRadius,
  getTerrainPropDisturbanceAffinity,
  getTerrainPropPlacementLayer,
  getTerrainPropRole,
  getTerrainPropSuccessionAffinity,
  getTerrainPropWetlandAffinity,
  TERRAIN_PROP_PAGE_SLOT_CAPACITY,
  TERRAIN_PROP_PALETTE_SHIFT,
  type LayerPropId,
  type SurfacePropId,
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

interface WeightedArchetype<Id extends TerrainPropArchetypeId = TerrainPropArchetypeId> {
  archetype: Id;
  weight: number;
}

interface PropProfile<Id extends TerrainPropArchetypeId = TerrainPropArchetypeId> {
  density: number;
  weights: readonly WeightedArchetype<Id>[];
}

type BiomePropProfile = PropProfile<SurfacePropId>;

type LayerFloraCell = TerrainCellInput & { layer: PersonalLayer; layerBiome: LayerBiome };

interface LayerFloraContext {
  densityMultiplier: number;
  elevationSeed: number;
  eligibleByKey: ReadonlyMap<string, LayerFloraCell>;
  field: TerrainField;
  moistureSeed: number;
  ownedByKey: ReadonlyMap<string, LayerFloraCell>;
  pageKey: string;
}

interface PreparedCandidates {
  candidates: PreparedTerrainPropCandidate[];
  ownedKeys: ReadonlySet<string>;
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
  layerWeights: readonly WeightedArchetype<SurfacePropId>[];
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
const SPACING_BUCKET_SIZE = 2;
const SPACING_HALO_LATTICE_CELLS = 2;
const TRUNK_CLEARANCE_RADIUS = 0.08;
const GROUND_COVER_CLEARANCE_RADIUS = 0.04;
const LAYER_RANK: Readonly<Record<TerrainPropPlacementLayer, number>> = Object.freeze({
  canopy: 0,
  understory: 1,
  debris: 2,
  groundcover: 3,
});
const TERRAIN_PROP_PLACEMENT_LAYERS = Object.freeze(["canopy", "understory", "debris", "groundcover"] as const);
export const PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER = 1.75;
const GROUND_COVER_DENSITY_RATIO = 0.24;
const BIOME_PROP_PROFILES: Readonly<Record<BiomeType, BiomePropProfile>> = {
  [BiomeType.Underground]: profile(0),
  [BiomeType.None]: profile(0),
  [BiomeType.DeepOcean]: profile(0),
  [BiomeType.Ocean]: profile(0),
  [BiomeType.Beach]: profile(0.64, ["palm", 6], ["boulder", 2], ["fallen-log", 3], ["grass-tuft", 5]),
  [BiomeType.Scorched]: profile(0.56, ["dead-tree", 4], ["boulder", 8], ["fallen-log", 1]),
  [BiomeType.Bare]: profile(0.8, ["boulder", 10], ["grass-tuft", 1]),
  [BiomeType.Tundra]: profile(0.92, ["boulder", 4], ["shrub", 5], ["grass-tuft", 8], ["wildflower", 2]),
  [BiomeType.Snow]: profile(0.48, ["boulder", 8], ["dead-tree", 1]),
  [BiomeType.TemperateDesert]: profile(0.88, ["boulder", 5], ["shrub", 5], ["grass-tuft", 6], ["dead-tree", 1]),
  [BiomeType.Shrubland]: profile(0.88, ["shrub", 9], ["boulder", 3], ["grass-tuft", 8], ["wildflower", 4]),
  [BiomeType.Taiga]: profile(
    1.32,
    ["conifer", 12],
    ["birch", 1],
    ["fallen-log", 3],
    ["boulder", 2],
    ["fern", 3],
    ["grass-tuft", 4],
  ),
  [BiomeType.Grassland]: profile(
    0.6,
    ["shrub", 2],
    ["birch", 1],
    ["boulder", 1],
    ["grass-tuft", 16],
    ["wildflower", 7],
  ),
  [BiomeType.TemperateDeciduousForest]: profile(
    1.24,
    ["broadleaf", 6],
    ["birch", 3],
    ["shrub", 2],
    ["mushroom", 1],
    ["fallen-log", 1],
    ["fern", 5],
    ["wildflower", 3],
  ),
  [BiomeType.TemperateRainForest]: profile(
    1.28,
    ["conifer", 6],
    ["broadleaf", 5],
    ["shrub", 2],
    ["fallen-log", 2],
    ["boulder", 1],
    ["mushroom", 1],
    ["fern", 13],
  ),
  [BiomeType.SubtropicalDesert]: profile(0.64, ["cactus", 9], ["boulder", 3], ["grass-tuft", 2]),
  [BiomeType.TropicalSeasonalForest]: profile(
    1.2,
    ["palm", 6],
    ["rainforest-canopy", 3],
    ["shrub", 3],
    ["fallen-log", 1],
    ["grass-tuft", 7],
    ["fern", 4],
    ["wildflower", 2],
  ),
  [BiomeType.TropicalRainForest]: profile(
    1.36,
    ["palm", 4],
    ["rainforest-canopy", 8],
    ["shrub", 3],
    ["fallen-log", 2],
    ["fern", 10],
    ["cycad", 4],
    ["wildflower", 2],
  ),
};
const LAYER_BIOME_PROP_PROFILES: Readonly<Record<LayerBiome, PropProfile<LayerPropId>>> = {
  "lantern-drift": profile(0.36, ["drift-banner", 1]),
  "pearl-flats": profile(0.5, ["frost-tuft", 1]),
  frostfall: profile(2.4, ["frost-tuft", 1]),
  stillstone: profile(0.6, ["standing-stone", 1]),
  rootweave: profile(0.6, ["root-arch", 6], ["glowcap", 1], ["hollow-fern", 4]),
  "glowcap-grove": profile(0.6, ["glowcap", 10], ["hollow-fern", 3]),
  bloomvault: profile(0.5, ["bloom-coral", 6], ["glowcap", 1]),
  "amber-seep": profile(0.36, ["glowcap", 2], ["root-arch", 1]),
};
const LAYER_WIND_AMPLITUDE: Readonly<Record<PersonalLayer, number>> = { 1: 0.12, 2: 0 };
const NO_GLOW = [0, 0, 0] as const;
const LAYER_BIOME_GLOW = Object.fromEntries(
  EVERY_LAYER_BIOME.map((biome) => [biome, hexToLinear(LAYER_BIOME_LOOKS[biome].glow)]),
) as Record<LayerBiome, readonly [number, number, number]>;
const LUSH_GROUND_FOLIAGE = 0.7;
const DUSTY_LEAF = [1.12, 0.95, 1.3] as const;
const PALETTE_GROUND_DRYNESS = Object.fromEntries(
  (Object.keys(TERRAIN_BIOME_DESCRIPTORS) as BiomeType[]).map((biome) => [
    biome,
    clampUnit(1 - TERRAIN_BIOME_DESCRIPTORS[biome].foliage / LUSH_GROUND_FOLIAGE) * 0.7,
  ]),
) as Record<BiomeType, number>;
const PALETTE_GROUND_LEAN = Object.fromEntries(
  (Object.keys(TERRAIN_BIOME_DESCRIPTORS) as BiomeType[]).map((biome) => [biome, resolvePaletteGroundLean(biome)]),
) as Record<BiomeType, readonly [number, number, number]>;

const MAX_PROFILE_DENSITY_BY_LAYER: Readonly<Record<TerrainPropPlacementLayer, number>> = Object.freeze(
  Object.fromEntries(
    TERRAIN_PROP_PLACEMENT_LAYERS.map((layer) => [
      layer,
      Math.max(...Object.values(BIOME_PROP_PROFILES).map((profile) => resolveLayerDensity(profile, layer))),
    ]),
  ) as Record<TerrainPropPlacementLayer, number>,
);

export function prepareTerrainPropInstances(request: TerrainPageRequest, field: TerrainField): TerrainPropInstance[] {
  const surface = prepareSurfaceCandidates(request, field);
  const layer = prepareLayerFloraCandidates(request, field);
  const owned = rejectCrowdedCandidates([...surface.candidates, ...layer.candidates]).filter(
    ({ ownerKey }) => surface.ownedKeys.has(ownerKey) || layer.ownedKeys.has(ownerKey),
  );
  return capToPageSlots(owned).map(toTerrainPropInstance).toSorted(compareTerrainPropInstances);
}

function prepareSurfaceCandidates(request: TerrainPageRequest, field: TerrainField): PreparedCandidates {
  const ownedCells = request.cells.filter(
    (cell): cell is TerrainCellInput & { biome: BiomeType } =>
      cell.explored && cell.biome !== null && !isEtherealTerrainCell(request, cell),
  );
  if (ownedCells.length === 0) return { candidates: [], ownedKeys: new Set() };
  const ownedByKey = new Map(ownedCells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
  const eligibleCells = [...request.halo, ...ownedCells].filter(
    (cell): cell is TerrainCellInput & { biome: BiomeType } =>
      cell.explored && cell.biome !== null && !isEtherealTerrainCell(request, cell),
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
  return {
    candidates: TERRAIN_PROP_PLACEMENT_LAYERS.flatMap((layer) => prepareTerrainPropLayer(layer, context)),
    ownedKeys: new Set(ownedByKey.keys()),
  };
}

function prepareLayerFloraCandidates(request: TerrainPageRequest, field: TerrainField): PreparedCandidates {
  const ownedByKey = indexLayerFloraCells(request.cells, request);
  if (ownedByKey.size === 0) return { candidates: [], ownedKeys: new Set() };
  const context: LayerFloraContext = {
    densityMultiplier: resolveDensityMultiplier(request.propDensityMultiplier),
    elevationSeed: resolveSeed(request.climate.elevation_seed),
    eligibleByKey: indexLayerFloraCells([...request.halo, ...request.cells], request),
    field,
    moistureSeed: resolveSeed(request.climate.moisture_seed),
    ownedByKey,
    pageKey: request.pageKey,
  };
  return {
    candidates: [
      ...TERRAIN_PROP_PLACEMENT_LAYERS.flatMap((layer) => prepareLayerFloraLayer(layer, context)),
      ...prepareLayerEdgeCandidates(context),
      ...prepareLayerCornerCandidates(context),
    ],
    ownedKeys: new Set(ownedByKey.keys()),
  };
}

function indexLayerFloraCells(
  cells: readonly TerrainCellInput[],
  request: Pick<TerrainPageRequest, "climate" | "mapCenter">,
): Map<string, LayerFloraCell> {
  const byKey = new Map<string, LayerFloraCell>();
  for (const cell of cells) {
    const layer = cell.surfacePresentation;
    if (!cell.explored || (layer !== 1 && layer !== 2)) continue;
    const layerBiome = layerBiomeAt(layer, cell.col + request.mapCenter, cell.row + request.mapCenter, request.climate);
    byKey.set(terrainCellKey(cell.col, cell.row), { ...cell, layer, layerBiome });
  }
  return byKey;
}

function prepareLayerFloraLayer(
  layer: TerrainPropPlacementLayer,
  context: LayerFloraContext,
): PreparedTerrainPropCandidate[] {
  const spacing = CANDIDATE_SPACING[layer];
  const bounds = expandCandidateBounds(
    resolveCandidateBounds(Array.from(context.ownedByKey.values()), spacing),
    SPACING_HALO_LATTICE_CELLS,
  );
  const candidates: PreparedTerrainPropCandidate[] = [];
  for (let latticeZ = bounds.minZ; latticeZ <= bounds.maxZ; latticeZ += 1) {
    for (let latticeX = bounds.minX; latticeX <= bounds.maxX; latticeX += 1) {
      const candidate = buildLayerFloraCandidate(latticeX, latticeZ, layer, spacing, context);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function saltedHash(
  latticeX: number,
  latticeZ: number,
  context: Pick<LayerFloraContext, "elevationSeed" | "moistureSeed">,
  prefix: string,
): (salt: string) => number {
  return (salt) => hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, `${prefix}-${salt}`);
}

function buildLayerFloraCandidate(
  latticeX: number,
  latticeZ: number,
  layer: TerrainPropPlacementLayer,
  spacing: number,
  context: LayerFloraContext,
): PreparedTerrainPropCandidate | null {
  const hash = saltedHash(latticeX, latticeZ, context, `layer-flora-${layer}`);
  const worldX = (latticeX + (hash("jitter-x") - 0.5) * 0.72) * spacing;
  const worldZ = (latticeZ + (hash("jitter-z") - 0.5) * 0.72) * spacing;
  const ownerCoordinate = findNearestTerrainHex(worldX, worldZ);
  const ownerKey = terrainCellKey(ownerCoordinate.col, ownerCoordinate.row);
  const owner = context.eligibleByKey.get(ownerKey);
  if (!owner || owner.occupied) return null;
  const propProfile = LAYER_BIOME_PROP_PROFILES[owner.layerBiome];
  const isScattered = ({ archetype }: WeightedArchetype<LayerPropId>) =>
    getLayerPropAnchor(archetype) === "scatter" && getTerrainPropPlacementLayer(archetype) === layer;
  const weights = propProfile.weights.filter(isScattered);
  const density =
    layer === "groundcover" ? resolveLayerDensity(propProfile, layer) : resolveProfileShare(propProfile, isScattered);
  if (weights.length === 0 || hash("acceptance") >= density * context.densityMultiplier) return null;
  const archetype = chooseArchetype(weights, hash("archetype"));
  if (!archetype) return null;
  const scale = 0.75 + hash("scale") * 0.5;
  if (!isClearOfUnits(archetype, scale, owner, worldX, worldZ, context.eligibleByKey)) return null;
  return {
    appearance: resolveLayerFloraAppearance(owner.layerBiome, hash("tint")),
    archetype,
    ownerCol: owner.col,
    ownerRow: owner.row,
    ownerKey,
    pageKey: context.pageKey,
    latticeX,
    latticeZ,
    layer,
    priority: hash("priority"),
    scale,
    worldX,
    worldY: context.field.sampleHeight(worldX, worldZ),
    worldZ,
    yaw: hash("yaw") * Math.PI * 2,
  };
}

function prepareLayerEdgeCandidates(context: LayerFloraContext): PreparedTerrainPropCandidate[] {
  const candidates: PreparedTerrainPropCandidate[] = [];
  for (const owner of context.eligibleByKey.values()) {
    if (owner.occupied) continue;
    terrainNeighborCoordinates(owner.col, owner.row).forEach((neighbour, edge) => {
      if (!ownsEdge(owner, neighbour)) return;
      for (const side of [-1, 1] as const) {
        const candidate = buildLayerEdgeCandidate(owner, neighbour, edge * 2 + (side + 1) / 2, side, context);
        if (candidate) candidates.push(candidate);
      }
    });
  }
  return candidates;
}

function ownsEdge(cell: Pick<TerrainCellInput, "col" | "row">, neighbour: Pick<TerrainCellInput, "col" | "row">) {
  return cell.row < neighbour.row || (cell.row === neighbour.row && cell.col < neighbour.col);
}

function buildLayerEdgeCandidate(
  owner: LayerFloraCell,
  neighbour: Pick<TerrainCellInput, "col" | "row">,
  slot: number,
  side: -1 | 1,
  context: LayerFloraContext,
): PreparedTerrainPropCandidate | null {
  const latticeX = owner.col * 12 + slot;
  const latticeZ = owner.row;
  const hash = saltedHash(latticeX, latticeZ, context, "layer-edge");
  const propProfile = LAYER_BIOME_PROP_PROFILES[owner.layerBiome];
  const onEdges = ({ archetype }: WeightedArchetype<LayerPropId>) => getLayerPropAnchor(archetype) === "edge";
  const weights = propProfile.weights.filter(onEdges);
  if (
    weights.length === 0 ||
    hash("acceptance") >= resolveProfileShare(propProfile, onEdges) * context.densityMultiplier
  )
    return null;
  const archetype = chooseArchetype(weights, hash("archetype"));
  if (!archetype) return null;
  const placement = resolveHalfEdgePlacement(owner, neighbour, side, archetype);
  const scale = placement.scale * (0.85 + hash("scale") * 0.15);
  if (!isClearOfUnits(archetype, scale, owner, placement.worldX, placement.worldZ, context.eligibleByKey)) return null;
  return {
    appearance: resolveLayerFloraAppearance(owner.layerBiome, hash("tint")),
    archetype,
    ownerCol: owner.col,
    ownerRow: owner.row,
    ownerKey: terrainCellKey(owner.col, owner.row),
    pageKey: context.pageKey,
    latticeX,
    latticeZ,
    layer: getTerrainPropPlacementLayer(archetype),
    priority: hash("priority"),
    scale,
    worldX: placement.worldX,
    worldY: context.field.sampleHeight(placement.worldX, placement.worldZ),
    worldZ: placement.worldZ,
    yaw: placement.yaw + (hash("flip") < 0.5 ? 0 : Math.PI),
  };
}

function prepareLayerCornerCandidates(context: LayerFloraContext): PreparedTerrainPropCandidate[] {
  const candidates: PreparedTerrainPropCandidate[] = [];
  for (const owner of context.eligibleByKey.values()) {
    if (owner.occupied) continue;
    const around = neighboursByBearing(owner);
    around.forEach((first, corner) => {
      const second = around[(corner + 1) % around.length];
      if (!ownsEdge(owner, first) || !ownsEdge(owner, second)) return;
      const candidate = buildLayerCornerCandidate(owner, [first, second], corner, context);
      if (candidate) candidates.push(candidate);
    });
  }
  return candidates;
}

function neighboursByBearing(cell: Pick<TerrainCellInput, "col" | "row">) {
  const centre = terrainHexToWorld(cell.col, cell.row);
  const bearing = ({ col, row }: Pick<TerrainCellInput, "col" | "row">) => {
    const point = terrainHexToWorld(col, row);
    return Math.atan2(point.z - centre.z, point.x - centre.x);
  };
  return terrainNeighborCoordinates(cell.col, cell.row).toSorted((a, b) => bearing(a) - bearing(b));
}

function buildLayerCornerCandidate(
  owner: LayerFloraCell,
  neighbours: readonly [Pick<TerrainCellInput, "col" | "row">, Pick<TerrainCellInput, "col" | "row">],
  corner: number,
  context: LayerFloraContext,
): PreparedTerrainPropCandidate | null {
  const latticeX = owner.col * 12 + corner;
  const latticeZ = owner.row;
  const hash = saltedHash(latticeX, latticeZ, context, "layer-corner");
  const propProfile = LAYER_BIOME_PROP_PROFILES[owner.layerBiome];
  const atCorners = ({ archetype }: WeightedArchetype<LayerPropId>) => getLayerPropAnchor(archetype) === "corner";
  const weights = propProfile.weights.filter(atCorners);
  if (
    weights.length === 0 ||
    hash("acceptance") >= resolveProfileShare(propProfile, atCorners) * context.densityMultiplier
  )
    return null;
  const archetype = chooseArchetype(weights, hash("archetype"));
  if (!archetype) return null;
  const centres = [owner, ...neighbours].map(({ col, row }) => terrainHexToWorld(col, row));
  const worldX = centres.reduce((sum, { x }) => sum + x, 0) / centres.length;
  const worldZ = centres.reduce((sum, { z }) => sum + z, 0) / centres.length;
  const scale = 0.8 + hash("scale") * 0.4;
  if (!isClearOfUnits(archetype, scale, owner, worldX, worldZ, context.eligibleByKey)) return null;
  return {
    appearance: resolveLayerFloraAppearance(owner.layerBiome, hash("tint")),
    archetype,
    ownerCol: owner.col,
    ownerRow: owner.row,
    ownerKey: terrainCellKey(owner.col, owner.row),
    pageKey: context.pageKey,
    latticeX,
    latticeZ,
    layer: getTerrainPropPlacementLayer(archetype),
    priority: hash("priority"),
    scale,
    worldX,
    worldY: context.field.sampleHeight(worldX, worldZ),
    worldZ,
    yaw: hash("yaw") * Math.PI * 2,
  };
}

function resolveHalfEdgePlacement(
  owner: Pick<TerrainCellInput, "col" | "row">,
  neighbour: Pick<TerrainCellInput, "col" | "row">,
  side: -1 | 1,
  archetype: TerrainPropArchetypeId,
) {
  const from = terrainHexToWorld(owner.col, owner.row);
  const to = terrainHexToWorld(neighbour.col, neighbour.row);
  const spacing = Math.hypot(to.x - from.x, to.z - from.z);
  const edgeX = -(to.z - from.z) / spacing;
  const edgeZ = (to.x - from.x) / spacing;
  const gap = spacing / (2 * Math.sqrt(3)) - TERRAIN_ARMY_ROUTE_HALF_WIDTH;
  const along = (TERRAIN_ARMY_ROUTE_HALF_WIDTH + gap / 2) * side;
  return {
    scale: gap / (2 * getTerrainPropFootprintRadius(archetype)),
    worldX: (from.x + to.x) / 2 + edgeX * along,
    worldZ: (from.z + to.z) / 2 + edgeZ * along,
    yaw: Math.atan2(-edgeZ, edgeX),
  };
}

export function resolveLayerFloraAppearance(biome: LayerBiome, tintVariation: number): TerrainPropAppearance {
  const shade = 0.9 + tintVariation * 0.1;
  return {
    glow: LAYER_BIOME_GLOW[biome],
    moss: 0,
    snow: 0,
    tint: [shade, shade, shade],
    windAmplitude: LAYER_WIND_AMPLITUDE[layerOfBiome(biome)],
  };
}

export function getLayerPropBiomes(archetype: LayerPropId): LayerBiome[] {
  return EVERY_LAYER_BIOME.filter((biome) =>
    LAYER_BIOME_PROP_PROFILES[biome].weights.some((weight) => weight.archetype === archetype),
  );
}

function layerOfBiome(biome: LayerBiome): PersonalLayer {
  return LAYER_BIOMES[1].some((veil) => veil === biome) ? 1 : 2;
}

/**
 * At most a page slot's worth of each archetype: a page denser than its slot keeps the props with the highest placement
 * priority, a hash spread evenly over the page, so it thins rather than losing a corner. No page can outgrow its slot.
 */
function capToPageSlots(candidates: PreparedTerrainPropCandidate[]): PreparedTerrainPropCandidate[] {
  const byArchetype = new Map<TerrainPropArchetypeId, PreparedTerrainPropCandidate[]>();
  for (const candidate of candidates) {
    const placed = byArchetype.get(candidate.archetype);
    if (placed) placed.push(candidate);
    else byArchetype.set(candidate.archetype, [candidate]);
  }
  return [...byArchetype].flatMap(([archetype, placed]) => {
    const capacity = TERRAIN_PROP_PAGE_SLOT_CAPACITY[archetype];
    return placed.length <= capacity ? placed : placed.toSorted((a, b) => b.priority - a.priority).slice(0, capacity);
  });
}

function prepareTerrainPropLayer(
  layer: TerrainPropPlacementLayer,
  context: TerrainPropPreparationContext,
): PreparedTerrainPropCandidate[] {
  const spacing = CANDIDATE_SPACING[layer];
  const layerBounds = resolveCandidateBounds(Array.from(context.ownedByKey.values()), spacing);
  const bounds = layer === "groundcover" ? layerBounds : expandCandidateBounds(layerBounds, SPACING_HALO_LATTICE_CELLS);
  const candidates: PreparedTerrainPropCandidate[] = [];
  for (let latticeZ = bounds.minZ; latticeZ <= bounds.maxZ; latticeZ += 1) {
    for (let latticeX = bounds.minX; latticeX <= bounds.maxX; latticeX += 1) {
      const candidate = prepareTerrainPropCandidate(latticeX, latticeZ, layer, spacing, context);
      if (candidate) candidates.push(candidate);
    }
  }
  return layer === "groundcover" ? candidates.filter(({ ownerKey }) => context.ownedByKey.has(ownerKey)) : candidates;
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
  const center = terrainHexToWorld(owner.col, owner.row);
  if (!isTerrainArmySpaceClear(worldX - center.x, worldZ - center.z)) return null;
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
  const scale = resolveTerrainPropScale(archetype, scaleValue, accepted.densityContext);
  if (!isClearOfUnits(archetype, scale, site.owner, site.worldX, site.worldZ, context.eligibleByKey)) return null;
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
    scale,
    worldX: site.worldX,
    worldY: accepted.surface.height,
    worldZ: site.worldZ,
    yaw:
      hashUnit(latticeX, latticeZ, context.elevationSeed, context.moistureSeed, `prop-${layer}-yaw-v2`) * Math.PI * 2,
  };
}

function isClearOfUnits(
  archetype: TerrainPropArchetypeId,
  scale: number,
  owner: Pick<TerrainCellInput, "col" | "row">,
  worldX: number,
  worldZ: number,
  eligibleByKey: ReadonlyMap<string, TerrainCellInput>,
): boolean {
  const center = terrainHexToWorld(owner.col, owner.row);
  if (!isTerrainArmySpaceClear(worldX - center.x, worldZ - center.z, resolveArmyClearanceFootprint(archetype) * scale))
    return false;
  return isTerrainPropFootprintClear(
    { archetype, scale, ownerCol: owner.col, ownerRow: owner.row, worldX, worldZ },
    {
      isBlocked: (col, row) => {
        const cell = eligibleByKey.get(terrainCellKey(col, row));
        return !cell || cell.occupied;
      },
      isOccupied: (col, row) => eligibleByKey.get(terrainCellKey(col, row))?.occupied ?? false,
    },
  );
}

function resolveArmyClearanceFootprint(archetype: TerrainPropArchetypeId): number {
  const layer = getTerrainPropPlacementLayer(archetype);
  if (layer === "canopy") return TRUNK_CLEARANCE_RADIUS;
  if (layer === "groundcover") return GROUND_COVER_CLEARANCE_RADIUS;
  return getTerrainPropSpacingRadius(archetype);
}

function resolveTerrainPropAppearance(
  archetype: SurfacePropId,
  tintVariation: number,
  context: TerrainPropDensityContext,
): TerrainPropAppearance {
  const climate = resolveTerrainPropClimate(context.biomeInfluences);
  const snow = clampUnit(climate.snow * (0.75 + context.elevation * 0.25));
  const mossSupport =
    smoothstep(0.3, 0.8, context.moisture) * (0.3 + context.canopyCover * 0.6 + context.debrisCover * 0.25);

  return {
    glow: NO_GLOW,
    moss: clampUnit(mossSupport * (1 - snow * 0.85) * (1 - resolveScorchedCoverage(context))),
    snow,
    tint: resolvePalettePropTint(archetype, tintVariation, context),
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

function rejectCrowdedCandidates(candidates: readonly PreparedTerrainPropCandidate[]): PreparedTerrainPropCandidate[] {
  const buckets = bucketSpacedCandidates(candidates.filter(({ layer }) => layer !== "groundcover"));
  return candidates.filter((candidate) => candidate.layer === "groundcover" || !isCrowdedOut(candidate, buckets));
}

function isCrowdedOut(
  candidate: PreparedTerrainPropCandidate,
  buckets: ReadonlyMap<string, PreparedTerrainPropCandidate[]>,
): boolean {
  const bucketX = Math.floor(candidate.worldX / SPACING_BUCKET_SIZE);
  const bucketZ = Math.floor(candidate.worldZ / SPACING_BUCKET_SIZE);
  for (let z = bucketZ - 1; z <= bucketZ + 1; z += 1) {
    for (let x = bucketX - 1; x <= bucketX + 1; x += 1) {
      const neighbours = buckets.get(`${x}:${z}`) ?? [];
      if (neighbours.some((other) => outranks(other, candidate) && footprintsOverlap(other, candidate))) return true;
    }
  }
  return false;
}

function bucketSpacedCandidates(
  candidates: readonly PreparedTerrainPropCandidate[],
): Map<string, PreparedTerrainPropCandidate[]> {
  const buckets = new Map<string, PreparedTerrainPropCandidate[]>();
  for (const candidate of candidates) {
    const key = `${Math.floor(candidate.worldX / SPACING_BUCKET_SIZE)}:${Math.floor(candidate.worldZ / SPACING_BUCKET_SIZE)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(candidate);
    else buckets.set(key, [candidate]);
  }
  return buckets;
}

function outranks(candidate: PreparedTerrainPropCandidate, other: PreparedTerrainPropCandidate): boolean {
  if (candidate === other) return false;
  if (candidate.layer !== other.layer) return LAYER_RANK[candidate.layer] < LAYER_RANK[other.layer];
  if (candidate.priority !== other.priority) return candidate.priority > other.priority;
  return (
    candidate.latticeZ < other.latticeZ ||
    (candidate.latticeZ === other.latticeZ && candidate.latticeX < other.latticeX)
  );
}

function footprintsOverlap(left: PreparedTerrainPropCandidate, right: PreparedTerrainPropCandidate): boolean {
  const minimumDistance =
    getTerrainPropSpacingRadius(left.archetype) * left.scale +
    getTerrainPropSpacingRadius(right.archetype) * right.scale;
  const deltaX = left.worldX - right.worldX;
  const deltaZ = left.worldZ - right.worldZ;
  return deltaX * deltaX + deltaZ * deltaZ < minimumDistance * minimumDistance;
}

function resolveEcologicalWeights(
  biome: BiomeType,
  weights: readonly WeightedArchetype<SurfacePropId>[],
  vegetation: TerrainPropDensityContext,
): WeightedArchetype<SurfacePropId>[] {
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

function resolveTerrainPropWetlandWeight(archetype: SurfacePropId, vegetation: TerrainPropDensityContext): number {
  const affinity = getTerrainPropWetlandAffinity(archetype);
  const wetland = 1 + vegetation.waterEdgeStrength * (affinity * 1.5 - 0.4);
  const verge = 1 + vegetation.roadEdgeStrength * (getTerrainPropSuccessionAffinity(archetype) * 0.8 - 0.15);
  return wetland * verge;
}

function resolveTerrainPropDisturbanceWeight(archetype: SurfacePropId, vegetation: TerrainPropDensityContext): number {
  const affinity = getTerrainPropDisturbanceAffinity(archetype);
  return 1 + vegetation.settlementEdgeStrength * (affinity * 1.35 - 0.3);
}

function resolveTerrainPropSuccessionWeight(archetype: SurfacePropId, vegetation: TerrainPropDensityContext): number {
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
  const volcanicStone = archetype === "boulder" ? resolveScorchedCoverage(vegetation) : 0;
  return (0.68 + shapedValue * 0.44) * (1 + volcanicStone * 0.5);
}

function resolvePalettePropTint(
  archetype: SurfacePropId,
  value: number,
  vegetation: TerrainPropDensityContext,
): readonly [number, number, number] {
  const base = resolveTerrainPropTint(archetype, value, vegetation);
  const tint: [number, number, number] = [0, 0, 0];
  for (const { biome, weight } of vegetation.biomeInfluences) {
    const lean = PALETTE_GROUND_LEAN[biome];
    const strength = TERRAIN_PROP_PALETTE_SHIFT[archetype];
    const dust = getTerrainPropRole(archetype) === "rigid" ? 0 : PALETTE_GROUND_DRYNESS[biome];
    for (let channel = 0; channel < 3; channel++) {
      const dusty = 1 + (DUSTY_LEAF[channel] - 1) * dust;
      tint[channel] += (1 + lean[channel] * strength) * dusty * weight;
    }
  }
  return [base[0] * tint[0], base[1] * tint[1], base[2] * tint[2]];
}

function resolvePaletteGroundLean(biome: BiomeType): readonly [number, number, number] {
  const linear = hexToLinear(TERRAIN_BIOME_DESCRIPTORS[biome].primary);
  const mean = (linear[0] + linear[1] + linear[2]) / 3 || 1;
  const [r, g, b] = linear.map((channel) => channel / mean - 1);
  return [r, g, b];
}

function hexToLinear(hex: string): readonly [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((start) => (parseInt(hex.slice(start, start + 2), 16) / 255) ** 2.2);
  return [r, g, b];
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
    if (archetype === "cycad") return [0.82 + value * 0.08, 0.9 + value * 0.07, 0.62 + wetness * 0.12];
    if (archetype === "wildflower") return [0.9 + value * 0.08, 0.94 + value * 0.05, 0.82 + value * 0.12];
    return [0.8 + dryness * 0.12, 0.9 - dryness * 0.14 + value * 0.05, 0.68 - dryness * 0.08];
  }
  const scorched = resolveScorchedCoverage(vegetation);
  const neutral = (0.9 + value * 0.1) * (1 - scorched * 0.62);
  return [neutral * (1 - scorched * 0.08), neutral, neutral * (1 + scorched * 0.06)];
}

function resolveScorchedCoverage(context: TerrainPropDensityContext): number {
  return context.biomeInfluences.reduce(
    (weight, influence) => weight + (influence.biome === BiomeType.Scorched ? influence.weight : 0),
    0,
  );
}

export function getTerrainPropBiomes(archetype: TerrainPropArchetypeId): BiomeType[] {
  return (Object.entries(BIOME_PROP_PROFILES) as [BiomeType, BiomePropProfile][])
    .filter(([, profile]) => profile.weights.some((weight) => weight.archetype === archetype))
    .map(([biome]) => biome);
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

function resolveProfileShare<Id extends TerrainPropArchetypeId>(
  profile: PropProfile<Id>,
  includes: (entry: WeightedArchetype<Id>) => boolean,
): number {
  const structural = profile.weights.filter(
    ({ archetype }) => getTerrainPropPlacementLayer(archetype) !== "groundcover",
  );
  const total = structural.reduce((sum, { weight }) => sum + weight, 0);
  if (total === 0) return 0;
  return (profile.density * structural.filter(includes).reduce((sum, { weight }) => sum + weight, 0)) / total;
}

function resolveLayerDensity(profile: PropProfile, layer: TerrainPropPlacementLayer | undefined): number {
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
  if (!Number.isFinite(multiplier) || multiplier < 0.1 || multiplier > 3) {
    throw new Error(`Terrain prop density multiplier must be from 0.1 to 3, received ${String(value)}`);
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

function chooseArchetype<Id extends TerrainPropArchetypeId>(
  weights: readonly WeightedArchetype<Id>[],
  value: number,
): Id | null {
  const totalWeight = weights.reduce((total, entry) => total + entry.weight, 0);
  let cursor = value * totalWeight;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.archetype;
  }
  return weights.at(-1)?.archetype ?? null;
}

function profile<Id extends TerrainPropArchetypeId>(
  density: number,
  ...weights: Array<readonly [Id, number]>
): PropProfile<Id> {
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
