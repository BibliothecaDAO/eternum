import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";

import { buildTerrainRoadSegments } from "../terrain-roads";
import type { TerrainPageRequest, TerrainRoadAnchor } from "../terrain-types";

export const ALL_BIOMES_FIXTURE_ID = "all-biomes-game-scale-v2";
export const ALL_BIOMES_COLUMNS = 20;
export const ALL_BIOMES_ROWS = 16;
export const TERRAIN_ANCHOR_COLUMNS = 18;
export const TERRAIN_ANCHOR_ROWS = 12;

export const TERRAIN_VERIFICATION_SCENE_IDS = Object.freeze([
  "all-biomes",
  "temperate-grove",
  "owned-roads",
  "settlement-regrowth",
  "tropical-coast",
  "arid-basin",
  "cold-front",
  "scorched-ridge",
  "fog-island",
  "fog-coast",
  "fog-frontier",
  "fog-reveal",
] as const);

export type TerrainVerificationSceneId = (typeof TERRAIN_VERIFICATION_SCENE_IDS)[number];
type TerrainBiomeAnchorSceneId = Exclude<TerrainVerificationSceneId, "all-biomes" | `fog-${string}`>;
export const TERRAIN_REVEAL_TARGET = Object.freeze({ col: 2, row: 4 });
const ROAD_VERIFICATION_ANCHORS: readonly TerrainRoadAnchor[] = Object.freeze([
  { col: 3, owner: "1", row: 3, structureId: "western-realm" },
  { col: 9, owner: "1", row: 6, structureId: "central-realm" },
  { col: 15, owner: "1", row: 3, structureId: "eastern-realm" },
  { col: 12, owner: "2", row: 9, structureId: "foreign-realm" },
]);
export const TERRAIN_SETTLEMENT_REGROWTH_SITES = Object.freeze([
  { col: 5, row: 4 },
  { col: 10, row: 7 },
  { col: 14, row: 4 },
]);
const SETTLEMENT_REGROWTH_ROAD_ANCHORS: readonly TerrainRoadAnchor[] = Object.freeze(
  TERRAIN_SETTLEMENT_REGROWTH_SITES.map((site, index) => ({
    ...site,
    owner: "settlement-evaluation-owner",
    structureId: `settlement-realm-${index + 1}`,
  })),
);

const BIOME_REGION_COLUMNS = 4;
const BIOME_REGION_WIDTH = ALL_BIOMES_COLUMNS / BIOME_REGION_COLUMNS;
const BIOME_REGION_HEIGHT = ALL_BIOMES_ROWS / 4;
const SHOWCASE_BIOME_GRID = Object.freeze([
  BiomeType.DeepOcean,
  BiomeType.Ocean,
  BiomeType.Beach,
  BiomeType.SubtropicalDesert,
  BiomeType.TropicalRainForest,
  BiomeType.TropicalSeasonalForest,
  BiomeType.Grassland,
  BiomeType.TemperateDesert,
  BiomeType.TemperateRainForest,
  BiomeType.TemperateDeciduousForest,
  BiomeType.Shrubland,
  BiomeType.Bare,
  BiomeType.Taiga,
  BiomeType.Tundra,
  BiomeType.Snow,
  BiomeType.Scorched,
] as const);

export function createAllBiomesTerrainRequest(): TerrainPageRequest {
  return {
    cells: createShowcaseCells(),
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    halo: [],
    mapCenter: 0,
    pageKey: ALL_BIOMES_FIXTURE_ID,
    roadSegments: [],
    strictBiomeParity: false,
    subdivisions: 2,
  };
}

export function createTerrainVerificationRequest(sceneId: TerrainVerificationSceneId): TerrainPageRequest {
  if (sceneId === "all-biomes") return createAllBiomesTerrainRequest();
  if (isFogVerificationScene(sceneId)) return createFogVerificationRequest(sceneId);
  const cells = createAnchorCells(sceneId);
  return {
    cells,
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    halo: [],
    mapCenter: 0,
    pageKey: `terrain-anchor:${sceneId}`,
    roadSegments:
      sceneId === "owned-roads"
        ? buildTerrainRoadSegments({ anchors: ROAD_VERIFICATION_ANCHORS, cells })
        : sceneId === "settlement-regrowth"
          ? buildTerrainRoadSegments({ anchors: SETTLEMENT_REGROWTH_ROAD_ANCHORS, cells })
          : [],
    strictBiomeParity: false,
    subdivisions: 3,
  };
}

function isFogVerificationScene(
  sceneId: TerrainVerificationSceneId,
): sceneId is Extract<TerrainVerificationSceneId, `fog-${string}`> {
  return sceneId === "fog-island" || sceneId === "fog-coast" || sceneId === "fog-frontier" || sceneId === "fog-reveal";
}

export function createTerrainRevealVerificationRequest(revealed: boolean): TerrainPageRequest {
  const request = createFogVerificationRequest("fog-reveal");
  if (!revealed) return request;
  return {
    ...request,
    cells: request.cells.map((cell) =>
      cell.col === TERRAIN_REVEAL_TARGET.col && cell.row === TERRAIN_REVEAL_TARGET.row
        ? {
            ...cell,
            biome: resolveAnchorBiome("temperate-grove", cell.col, cell.row),
            explored: true,
            previewBiome: resolveAnchorBiome("temperate-grove", cell.col, cell.row),
          }
        : cell,
    ),
  };
}

function createFogVerificationRequest(
  sceneId: Extract<TerrainVerificationSceneId, `fog-${string}`>,
): TerrainPageRequest {
  const source =
    sceneId === "fog-frontier"
      ? createShowcaseCells()
      : createAnchorCells(sceneId === "fog-coast" ? "tropical-coast" : "temperate-grove");
  return {
    cells: source.map((cell) => (isFogCellExplored(sceneId, cell.col, cell.row) ? cell : concealCell(cell))),
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    halo: [],
    mapCenter: 0,
    pageKey: `terrain-anchor:${sceneId}`,
    roadSegments: [],
    strictBiomeParity: false,
    subdivisions: 3,
  };
}

function isFogCellExplored(
  sceneId: Extract<TerrainVerificationSceneId, `fog-${string}`>,
  col: number,
  row: number,
): boolean {
  if (sceneId === "fog-frontier") return col < 8 + Math.sin(row * 0.72) * 2.2;
  if (sceneId === "fog-coast") return col > 3 + Math.sin(row * 0.65) * 1.6 && row < 10;
  if (sceneId === "fog-reveal" && col === TERRAIN_REVEAL_TARGET.col && row === TERRAIN_REVEAL_TARGET.row) {
    return false;
  }
  const centerCol = TERRAIN_ANCHOR_COLUMNS * 0.48;
  const centerRow = TERRAIN_ANCHOR_ROWS * 0.5;
  const dx = (col - centerCol) / 6.2;
  const dy = (row - centerRow) / 4.1;
  return dx * dx + dy * dy + Math.sin(col * 0.8 + row * 0.33) * 0.12 < 1;
}

function concealCell<TCell extends { biome: BiomeType; col: number; occupied: boolean; row: number }>(cell: TCell) {
  return { ...cell, biome: null, explored: false, occupied: false, previewBiome: cell.biome };
}

function createShowcaseCells() {
  return Array.from({ length: ALL_BIOMES_COLUMNS * ALL_BIOMES_ROWS }, (_, index) => {
    const col = index % ALL_BIOMES_COLUMNS;
    const row = Math.floor(index / ALL_BIOMES_COLUMNS);
    const biome = resolveShowcaseBiome(col, row);
    return {
      biome,
      col,
      explored: true,
      occupied: false,
      previewBiome: biome,
      row,
    };
  });
}

function resolveShowcaseBiome(col: number, row: number): BiomeType {
  const warpedCol = col + Math.sin(row * 0.72) * 0.65 + Math.sin((col + row) * 0.31) * 0.35;
  const warpedRow = row + Math.sin(col * 0.51) * 0.55;
  const regionCol = clampRegion(Math.floor(warpedCol / BIOME_REGION_WIDTH), BIOME_REGION_COLUMNS);
  const regionRow = clampRegion(Math.floor(warpedRow / BIOME_REGION_HEIGHT), SHOWCASE_BIOME_GRID.length / 4);
  return SHOWCASE_BIOME_GRID[regionRow * BIOME_REGION_COLUMNS + regionCol];
}

function createAnchorCells(sceneId: TerrainBiomeAnchorSceneId) {
  return Array.from({ length: TERRAIN_ANCHOR_COLUMNS * TERRAIN_ANCHOR_ROWS }, (_, index) => {
    const col = index % TERRAIN_ANCHOR_COLUMNS;
    const row = Math.floor(index / TERRAIN_ANCHOR_COLUMNS);
    const biome = resolveAnchorBiome(sceneId, col, row);
    return {
      biome,
      col,
      explored: true,
      occupied:
        sceneId === "owned-roads"
          ? ROAD_VERIFICATION_ANCHORS.some((anchor) => anchor.col === col && anchor.row === row)
          : sceneId === "settlement-regrowth"
            ? TERRAIN_SETTLEMENT_REGROWTH_SITES.some((site) => site.col === col && site.row === row)
            : col === Math.floor(TERRAIN_ANCHOR_COLUMNS * 0.58) && row === Math.floor(TERRAIN_ANCHOR_ROWS * 0.52),
      previewBiome: biome,
      row,
    };
  });
}

function resolveAnchorBiome(sceneId: TerrainBiomeAnchorSceneId, col: number, row: number): BiomeType {
  const x = col / (TERRAIN_ANCHOR_COLUMNS - 1);
  const y = row / (TERRAIN_ANCHOR_ROWS - 1);
  const warp = Math.sin(row * 0.82 + col * 0.21) * 0.045 + Math.sin(col * 0.47) * 0.035;
  switch (sceneId) {
    case "owned-roads":
      if (y + warp < 0.22) return BiomeType.Grassland;
      if (x - warp > 0.72) return BiomeType.TemperateRainForest;
      return BiomeType.TemperateDeciduousForest;
    case "settlement-regrowth":
      if (y + warp < 0.2) return BiomeType.Grassland;
      if (x - warp > 0.74) return BiomeType.TemperateRainForest;
      return BiomeType.TemperateDeciduousForest;
    case "temperate-grove":
      if (y + warp < 0.22) return BiomeType.Grassland;
      if (x - warp > 0.68) return BiomeType.TemperateRainForest;
      return y - warp > 0.78 ? BiomeType.Shrubland : BiomeType.TemperateDeciduousForest;
    case "tropical-coast":
      if (x + warp < 0.16) return BiomeType.DeepOcean;
      if (x + warp < 0.3) return BiomeType.Ocean;
      if (x + warp < 0.4) return BiomeType.Beach;
      return y + warp < 0.48 ? BiomeType.TropicalRainForest : BiomeType.TropicalSeasonalForest;
    case "arid-basin":
      if (y + warp < 0.22) return BiomeType.Shrubland;
      if (x - warp > 0.76) return BiomeType.Bare;
      return x + y + warp > 1.18 ? BiomeType.TemperateDesert : BiomeType.SubtropicalDesert;
    case "cold-front":
      if (y + warp < 0.28) return BiomeType.Taiga;
      if (y + warp < 0.56) return BiomeType.Tundra;
      return x - warp > 0.78 ? BiomeType.Bare : BiomeType.Snow;
    case "scorched-ridge":
      if (x + warp < 0.24) return BiomeType.Grassland;
      if (x + warp < 0.45) return BiomeType.TemperateDesert;
      return y - warp > 0.76 ? BiomeType.Bare : BiomeType.Scorched;
  }
}

function clampRegion(value: number, count: number): number {
  return Math.min(count - 1, Math.max(0, value));
}
