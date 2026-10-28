import { Biome, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { terrainHexToWorld, terrainNeighborCoordinates } from "../../../terrain/terrain-coordinates";

/**
 * One sand-and-water region drawn from the contract's own climate: each hex's elevation is the contract's, and every
 * height, shoreline and dune between hexes is a pure function of that elevation and the world position. Same seed and
 * coordinates, same picture, for every player.
 */
const SAND_WATER_CLIMATE: BiomeClimateConfig = {
  elevation_scale_bps: 10_000,
  moisture_scale_bps: 10_000,
  elevation_bias_bps: 9_000,
  moisture_bias_bps: 10_000,
  elevation_seed: 2024,
  moisture_seed: 5,
};
const MAP_OFFSET = 40;
const REGION = { minCol: -12, maxCol: 12, minRow: -9, maxRow: 9 } as const;

/** The contract's biome levels (biome.cairo): deep ocean below 0.17, ocean below 0.26, beach below 0.31. */
const OCEAN_LEVEL = 0.26;
const DEEP_LEVEL = 0.17;
const BEACH_LEVEL = 0.31;
/** Just past one hex spacing (√3): a centre keeps its own elevation, so a hex always shows its contract biome. */
const KERNEL_RADIUS = 1.75;

export type SandWaterKind = "deep" | "shallow" | "beach" | "desert";

export interface SandWaterCell {
  col: number;
  row: number;
  x: number;
  z: number;
  elevation: number;
  kind: SandWaterKind;
}

export interface SandWaterWorld {
  cells: SandWaterCell[];
  cellAt(col: number, row: number): SandWaterCell | undefined;
  /** The contract elevation, carried smoothly between hex centres. */
  elevationAt(x: number, z: number): number;
  /** Ground height: 0 is the waterline; the coast crosses it on the contour between a land and a water centre. */
  groundAt(x: number, z: number): number;
  /** Dune relief on dry sand, fading to nothing at the waterline. */
  dunesAt(x: number, z: number): number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function createSandWaterWorld(): SandWaterWorld {
  const cells: SandWaterCell[] = [];
  const byKey = new Map<string, SandWaterCell>();
  for (let row = REGION.minRow - 2; row <= REGION.maxRow + 2; row++) {
    for (let col = REGION.minCol - 2; col <= REGION.maxCol + 2; col++) {
      const { elevation } = Biome.sampleEnvironment(col + MAP_OFFSET, row + MAP_OFFSET, SAND_WATER_CLIMATE);
      const { x, z } = terrainHexToWorld(col, row);
      const cell = { col, row, x, z, elevation, kind: kindOf(elevation) };
      byKey.set(`${col}:${row}`, cell);
      if (col >= REGION.minCol && col <= REGION.maxCol && row >= REGION.minRow && row <= REGION.maxRow)
        cells.push(cell);
    }
  }
  const all = [...byKey.values()];
  const bucket = new Map<string, SandWaterCell[]>();
  for (const cell of all) {
    const key = `${Math.floor(cell.x / 2)}:${Math.floor(cell.z / 2)}`;
    bucket.set(key, [...(bucket.get(key) ?? []), cell]);
  }
  const elevationAt = (x: number, z: number) => {
    let sum = 0;
    let weights = 0;
    const bx = Math.floor(x / 2),
      bz = Math.floor(z / 2);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const cell of bucket.get(`${bx + dx}:${bz + dz}`) ?? []) {
          const d2 = (cell.x - x) ** 2 + (cell.z - z) ** 2;
          if (d2 >= KERNEL_RADIUS * KERNEL_RADIUS) continue;
          const weight = (1 - d2 / (KERNEL_RADIUS * KERNEL_RADIUS)) ** 3;
          sum += cell.elevation * weight;
          weights += weight;
        }
      }
    }
    return weights === 0 ? 0 : sum / weights;
  };
  const groundAt = (x: number, z: number) => heightOf(elevationAt(x, z));
  const dunesAt = (x: number, z: number) => {
    const ground = groundAt(x, z);
    if (ground <= 0) return 0;
    const warp = Math.sin(x * 0.31 + Math.sin(z * 0.23) * 1.7) * 1.3;
    const crest = 1 - Math.abs(Math.sin((x * 0.74 + z * 0.42) * 1.9 + warp));
    return crest * crest * 0.16 * smoothstep(0.02, 0.18, ground);
  };
  return {
    cells,
    cellAt: (col, row) => byKey.get(`${col}:${row}`),
    elevationAt,
    groundAt,
    dunesAt,
    bounds: resolveBounds(cells),
  };
}

function kindOf(elevation: number): SandWaterKind {
  if (elevation < DEEP_LEVEL) return "deep";
  if (elevation < OCEAN_LEVEL) return "shallow";
  if (elevation < BEACH_LEVEL) return "beach";
  return "desert";
}

/** Monotone through the contract levels: the waterline sits exactly at the ocean level. */
function heightOf(elevation: number): number {
  return elevation >= OCEAN_LEVEL ? (elevation - OCEAN_LEVEL) * 1.6 : (elevation - OCEAN_LEVEL) * 2.6;
}

function resolveBounds(cells: SandWaterCell[]) {
  return {
    minX: Math.min(...cells.map((cell) => cell.x)) - 1,
    maxX: Math.max(...cells.map((cell) => cell.x)) + 1,
    minZ: Math.min(...cells.map((cell) => cell.z)) - 1,
    maxZ: Math.max(...cells.map((cell) => cell.z)) + 1,
  };
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Every land cell beside water, nearest the region's centre first: where the realm and the army stand. */
export function resolveCoastalStage(world: SandWaterWorld): { realm: SandWaterCell; army: SandWaterCell } {
  const isLand = (cell?: SandWaterCell) => cell && (cell.kind === "beach" || cell.kind === "desert");
  const neighbours = (cell: SandWaterCell) =>
    terrainNeighborCoordinates(cell.col, cell.row).map(({ col, row }) => world.cellAt(col, row));
  const coast = world.cells
    .filter((cell) => isLand(cell) && neighbours(cell).some((next) => next && !isLand(next)))
    .toSorted((left, right) => Math.hypot(left.x, left.z) - Math.hypot(right.x, right.z));
  for (const army of coast) {
    const realm = neighbours(army).find((next) => isLand(next) && !coast.includes(next!));
    if (realm) return { realm, army };
  }
  throw new Error("The sand-and-water region has no coast with an inland hex behind it");
}
