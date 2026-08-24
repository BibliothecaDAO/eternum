import { NEUTRAL_BIOME_CLIMATE, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";

import { hashTerrainCoordinates, terrainHashToUnitFloat } from "../terrain-hash";
import type { WorldmapProceduralPresentationInput } from "../worldmap-procedural-terrain";
import type { TerrainBenchmarkTraceMode } from "./terrain-benchmark-contract";
import type { TerrainBenchmarkExplorationMode } from "./terrain-benchmark-contract";

export const TERRAIN_BENCHMARK_FIXTURE_ID = "fullscreen-balanced-v2";
export const TERRAIN_BENCHMARK_PAGE_SIZE = 24;
export const TERRAIN_BENCHMARK_PAGE_COLUMNS = 12;
export const TERRAIN_BENCHMARK_PAGE_ROWS = 12;
const TERRAIN_BENCHMARK_TRAVERSAL_COLUMNS = 10;
const TERRAIN_BENCHMARK_TRAVERSAL_ROWS = 10;
export const TERRAIN_BENCHMARK_WINDOW_COLUMNS = 4;
export const TERRAIN_BENCHMARK_WINDOW_ROWS = 3;
export const TERRAIN_BENCHMARK_CELL_COLUMNS = TERRAIN_BENCHMARK_PAGE_COLUMNS * TERRAIN_BENCHMARK_PAGE_SIZE;
export const TERRAIN_BENCHMARK_CELL_ROWS = TERRAIN_BENCHMARK_PAGE_ROWS * TERRAIN_BENCHMARK_PAGE_SIZE;

export interface TerrainBenchmarkPageCoordinate {
  col: number;
  row: number;
}

export interface TerrainBenchmarkCell {
  biomeKey: string;
  col: number;
  occupied: boolean;
  row: number;
}

export interface TerrainBenchmarkFixture {
  climate: BiomeClimateConfig;
  fingerprint: string;
  pageColumns: number;
  pageRows: number;
  pages: ReadonlyMap<string, readonly TerrainBenchmarkCell[]>;
}

interface TerrainBenchmarkWindowOptions {
  densityMultiplier?: number;
  explorationMode?: TerrainBenchmarkExplorationMode;
}

const CLIMATE = Object.freeze({ ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 });
const MIN_PAGE_COL = -Math.floor(TERRAIN_BENCHMARK_PAGE_COLUMNS / 2);
const MIN_PAGE_ROW = -Math.floor(TERRAIN_BENCHMARK_PAGE_ROWS / 2);
const MAX_PAGE_COL = MIN_PAGE_COL + TERRAIN_BENCHMARK_PAGE_COLUMNS - 1;
const MAX_PAGE_ROW = MIN_PAGE_ROW + TERRAIN_BENCHMARK_PAGE_ROWS - 1;
const MIN_TRAVERSAL_PAGE_COL = -Math.floor(TERRAIN_BENCHMARK_TRAVERSAL_COLUMNS / 2);
const MIN_TRAVERSAL_PAGE_ROW = -Math.floor(TERRAIN_BENCHMARK_TRAVERSAL_ROWS / 2);
const BENCHMARK_BIOMES = Object.freeze([
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

export function createTerrainBenchmarkFixture(): TerrainBenchmarkFixture {
  const pages = new Map<string, readonly TerrainBenchmarkCell[]>();
  for (let pageRow = MIN_PAGE_ROW; pageRow <= MAX_PAGE_ROW; pageRow += 1) {
    for (let pageCol = MIN_PAGE_COL; pageCol <= MAX_PAGE_COL; pageCol += 1) {
      pages.set(terrainBenchmarkPageKey(pageCol, pageRow), createPageCells(pageCol, pageRow));
    }
  }
  return {
    climate: { ...CLIMATE },
    fingerprint: TERRAIN_BENCHMARK_FIXTURE_ID,
    pageColumns: TERRAIN_BENCHMARK_PAGE_COLUMNS,
    pageRows: TERRAIN_BENCHMARK_PAGE_ROWS,
    pages,
  };
}

export function createTerrainBenchmarkWindowInput(
  fixture: TerrainBenchmarkFixture,
  focus: TerrainBenchmarkPageCoordinate,
  options: TerrainBenchmarkWindowOptions = {},
): WorldmapProceduralPresentationInput {
  const pageWindow = resolveTerrainBenchmarkPageWindow(focus);
  return {
    cells: pageWindow.flatMap(({ col, row }) => {
      const cells = fixture.pages.get(terrainBenchmarkPageKey(col, row));
      if (!cells) throw new Error(`Terrain benchmark fixture is missing page ${col},${row}`);
      return cells.map((cell) => applyBenchmarkExploration(cell, options.explorationMode ?? "explored"));
    }),
    climate: fixture.climate,
    generation: 1,
    mapCenter: 0,
    pageHeight: TERRAIN_BENCHMARK_PAGE_SIZE,
    pageWidth: TERRAIN_BENCHMARK_PAGE_SIZE,
    propDensityMultiplier: options.densityMultiplier,
    subdivisions: 2,
  };
}

function applyBenchmarkExploration(
  cell: TerrainBenchmarkCell,
  explorationMode: TerrainBenchmarkExplorationMode,
): TerrainBenchmarkCell {
  if (explorationMode === "explored" || isBenchmarkFrontierExplored(cell.col, cell.row)) return cell;
  return { ...cell, biomeKey: "Outline", occupied: false };
}

function isBenchmarkFrontierExplored(col: number, row: number): boolean {
  const boundary = Math.sin(row * 0.055) * 22 + Math.sin(row * 0.017 + 1.4) * 11;
  return col < boundary;
}

export function createTerrainBenchmarkMotionWaypoints(
  traceMode: TerrainBenchmarkTraceMode = "performance",
): TerrainBenchmarkPageCoordinate[] {
  const waypoints = [
    { col: -3, row: -2 },
    { col: -2, row: -2 },
    { col: -1, row: -2 },
    { col: 0, row: -2 },
    { col: 1, row: -2 },
    { col: 2, row: -2 },
    { col: 3, row: -1 },
    { col: 2, row: 0 },
    { col: 1, row: 1 },
    { col: 0, row: 2 },
    { col: -1, row: 3 },
    { col: -2, row: 2 },
    { col: -3, row: 1 },
  ];
  return traceMode === "structural" ? waypoints.filter((_, index) => index % 2 === 0) : waypoints;
}

export function createTerrainBenchmarkLifecycleWaypoints(): TerrainBenchmarkPageCoordinate[] {
  return Array.from({ length: TERRAIN_BENCHMARK_TRAVERSAL_ROWS }, (_, rowIndex) => {
    const row = MIN_TRAVERSAL_PAGE_ROW + rowIndex;
    const columns = Array.from(
      { length: TERRAIN_BENCHMARK_TRAVERSAL_COLUMNS },
      (__, colIndex) => MIN_TRAVERSAL_PAGE_COL + colIndex,
    );
    if (rowIndex % 2 === 1) columns.reverse();
    return columns.map((col) => ({ col, row }));
  }).flat();
}

export function resolveTerrainBenchmarkPageWindow(
  focus: TerrainBenchmarkPageCoordinate,
): TerrainBenchmarkPageCoordinate[] {
  const startCol = clampPageWindowStart(focus.col - 1, MIN_PAGE_COL, MAX_PAGE_COL, TERRAIN_BENCHMARK_WINDOW_COLUMNS);
  const startRow = clampPageWindowStart(focus.row - 1, MIN_PAGE_ROW, MAX_PAGE_ROW, TERRAIN_BENCHMARK_WINDOW_ROWS);
  return Array.from({ length: TERRAIN_BENCHMARK_WINDOW_COLUMNS * TERRAIN_BENCHMARK_WINDOW_ROWS }, (_, index) => ({
    col: startCol + (index % TERRAIN_BENCHMARK_WINDOW_COLUMNS),
    row: startRow + Math.floor(index / TERRAIN_BENCHMARK_WINDOW_COLUMNS),
  }));
}

function terrainBenchmarkPageKey(col: number, row: number): string {
  return `${row},${col}`;
}

function createPageCells(pageCol: number, pageRow: number): TerrainBenchmarkCell[] {
  const startCol = pageCol * TERRAIN_BENCHMARK_PAGE_SIZE;
  const startRow = pageRow * TERRAIN_BENCHMARK_PAGE_SIZE;
  return Array.from({ length: TERRAIN_BENCHMARK_PAGE_SIZE ** 2 }, (_, index) => {
    const col = startCol + (index % TERRAIN_BENCHMARK_PAGE_SIZE);
    const row = startRow + Math.floor(index / TERRAIN_BENCHMARK_PAGE_SIZE);
    const biome = resolveBenchmarkBiome(col, row);
    return {
      biomeKey: biome,
      col,
      occupied: isBenchmarkStructureCell(col, row, biome),
      row,
    };
  });
}

function resolveBenchmarkBiome(col: number, row: number): BiomeType {
  const normalizedCol = (col - MIN_PAGE_COL * TERRAIN_BENCHMARK_PAGE_SIZE) / TERRAIN_BENCHMARK_CELL_COLUMNS;
  const normalizedRow = (row - MIN_PAGE_ROW * TERRAIN_BENCHMARK_PAGE_SIZE) / TERRAIN_BENCHMARK_CELL_ROWS;
  const warpedCol = normalizedCol + Math.sin(row * 0.045) * 0.035 + Math.sin((col + row) * 0.021) * 0.02;
  const warpedRow = normalizedRow + Math.sin(col * 0.038) * 0.04;
  const regionCol = clampRegion(Math.floor(warpedCol * 4), 4);
  const regionRow = clampRegion(Math.floor(warpedRow * 4), 4);
  return BENCHMARK_BIOMES[regionRow * 4 + regionCol];
}

function isBenchmarkStructureCell(col: number, row: number, biome: BiomeType): boolean {
  if (biome === BiomeType.DeepOcean || biome === BiomeType.Ocean || biome === BiomeType.Beach) return false;
  const occupation = terrainHashToUnitFloat(
    hashTerrainCoordinates({ col, row, elevationSeed: 137, moistureSeed: 991, salt: "terrain-benchmark-occupied-v1" }),
  );
  return occupation > 0.9975;
}

function clampPageWindowStart(start: number, minimum: number, maximum: number, count: number): number {
  return Math.min(maximum - count + 1, Math.max(minimum, start));
}

function clampRegion(value: number, count: number): number {
  return Math.min(count - 1, Math.max(0, value));
}
