import { Biome, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import {
  findNearestTerrainHex,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "../../../terrain/terrain-coordinates";
import { createAllBiomesTerrainRequest } from "../../../terrain/verification/terrain-verification-fixtures";

/**
 * A field of hexes drawn from the contract's own climate. Every height, surface weight and border between hexes is a
 * pure function of each hex's elevation and moisture and of the world position: same seed and coordinates, same
 * picture, for every player.
 */
export type BiomeField = "bench" | "seeded";

/** The ground surfaces the shader paints; each biome is a mix of them (see BIOME_SURFACES). */
export const SURFACES = [
  "sand",
  "clay",
  "grass",
  "forest",
  "jungle",
  "needles",
  "tundra",
  "rock",
  "snow",
  "lava",
  "seabed",
] as const;
export type Surface = (typeof SURFACES)[number];

export interface BiomeCell {
  col: number;
  row: number;
  x: number;
  z: number;
  biome: BiomeType;
  /** The contract's elevation and moisture (0 to 1), inside the band that picks this hex's biome. */
  elevation: number;
  moisture: number;
}

export interface BiomeWorld {
  cells: BiomeCell[];
  cellAt(col: number, row: number): BiomeCell | undefined;
  /** Ground height: 0 is the waterline. */
  heightAt(x: number, z: number): number;
  /** How much each surface paints the ground here, in SURFACES order, summing to 1. */
  surfacesAt(x: number, z: number): number[];
  /** The biome whose influence is strongest here. */
  biomeAt(x: number, z: number): BiomeType;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const SEEDED_CLIMATE: BiomeClimateConfig = {
  elevation_scale_bps: 10_000,
  moisture_scale_bps: 10_000,
  elevation_bias_bps: 10_000,
  moisture_bias_bps: 10_000,
  elevation_seed: 2024,
  moisture_seed: 5,
};
const SEEDED_OFFSET = 60;
const SEEDED_REGION = { minCol: 0, maxCol: 19, minRow: 0, maxRow: 15 } as const;
/** Just past one hex spacing (√3): a hex centre keeps its own biome and elevation. */
const KERNEL_RADIUS = 1.75;
/** Borders wander by up to this much, so biomes meet along organic lines, never the hex edge. */
const BORDER_WARP = 0.32;

/** The contract's bands (biome.cairo): the elevation and moisture ranges that pick each biome. */
const BIOME_BANDS: Record<BiomeType, { elevation: [number, number]; moisture: [number, number] }> = {
  [BiomeType.DeepOcean]: { elevation: [0.02, 0.17], moisture: [0, 1] },
  [BiomeType.Ocean]: { elevation: [0.17, 0.26], moisture: [0, 1] },
  [BiomeType.Beach]: { elevation: [0.26, 0.31], moisture: [0, 1] },
  [BiomeType.SubtropicalDesert]: { elevation: [0.31, 0.42], moisture: [0, 0.4] },
  [BiomeType.Grassland]: { elevation: [0.31, 0.5], moisture: [0.3, 0.45] },
  [BiomeType.TropicalSeasonalForest]: { elevation: [0.31, 0.42], moisture: [0.45, 0.62] },
  [BiomeType.TropicalRainForest]: { elevation: [0.31, 0.42], moisture: [0.62, 1] },
  [BiomeType.TemperateDeciduousForest]: { elevation: [0.42, 0.5], moisture: [0.45, 0.6] },
  [BiomeType.TemperateRainForest]: { elevation: [0.42, 0.5], moisture: [0.6, 1] },
  [BiomeType.TemperateDesert]: { elevation: [0.42, 0.56], moisture: [0, 0.4] },
  [BiomeType.Shrubland]: { elevation: [0.5, 0.56], moisture: [0.4, 0.6] },
  [BiomeType.Taiga]: { elevation: [0.5, 0.56], moisture: [0.6, 1] },
  [BiomeType.Scorched]: { elevation: [0.56, 0.74], moisture: [0, 0.35] },
  [BiomeType.Bare]: { elevation: [0.56, 0.74], moisture: [0.35, 0.45] },
  [BiomeType.Tundra]: { elevation: [0.56, 0.74], moisture: [0.45, 0.6] },
  [BiomeType.Snow]: { elevation: [0.56, 0.74], moisture: [0.6, 1] },
  [BiomeType.Underground]: { elevation: [0.4, 0.5], moisture: [0, 1] },
  [BiomeType.None]: { elevation: [0.4, 0.5], moisture: [0, 1] },
};

/** Each biome's ground, as a mix of surfaces. */
const BIOME_SURFACES: Record<BiomeType, Partial<Record<Surface, number>>> = {
  [BiomeType.DeepOcean]: { seabed: 1 },
  [BiomeType.Ocean]: { seabed: 0.6, sand: 0.4 },
  [BiomeType.Beach]: { sand: 1 },
  [BiomeType.SubtropicalDesert]: { sand: 0.9, clay: 0.1 },
  [BiomeType.Grassland]: { grass: 1 },
  [BiomeType.TropicalSeasonalForest]: { forest: 0.55, clay: 0.25, grass: 0.2 },
  [BiomeType.TropicalRainForest]: { jungle: 1 },
  [BiomeType.TemperateDeciduousForest]: { forest: 1 },
  [BiomeType.TemperateRainForest]: { jungle: 0.6, needles: 0.4 },
  [BiomeType.TemperateDesert]: { clay: 1 },
  [BiomeType.Shrubland]: { clay: 0.45, grass: 0.55 },
  [BiomeType.Taiga]: { needles: 1 },
  [BiomeType.Scorched]: { lava: 1 },
  [BiomeType.Bare]: { rock: 1 },
  [BiomeType.Tundra]: { tundra: 1 },
  [BiomeType.Snow]: { snow: 1 },
  [BiomeType.Underground]: { rock: 1 },
  [BiomeType.None]: { rock: 1 },
};

export function createBiomeWorld(field: BiomeField): BiomeWorld {
  const cells = field === "bench" ? benchCells() : seededCells();
  const byKey = new Map(cells.map((cell) => [`${cell.col}:${cell.row}`, cell]));
  const bucket = new Map<string, BiomeCell[]>();
  for (const cell of cells) {
    const key = `${Math.floor(cell.x / 2)}:${Math.floor(cell.z / 2)}`;
    bucket.set(key, [...(bucket.get(key) ?? []), cell]);
  }
  const influences = (x: number, z: number) => {
    // The warp fades out toward every hex centre, so a centre always shows its own contract biome.
    const hex = findNearestTerrainHex(x, z);
    const centre = terrainHexToWorld(hex.col, hex.row);
    const reach = smoothstep(0.25, 0.7, Math.hypot(x - centre.x, z - centre.z)) * BORDER_WARP;
    const wx = x + (hashNoise(x * 0.9, z * 0.9, 11) - 0.5) * 2 * reach;
    const wz = z + (hashNoise(x * 0.9, z * 0.9, 23) - 0.5) * 2 * reach;
    const found: Array<{ cell: BiomeCell; weight: number }> = [];
    let total = 0;
    const bx = Math.floor(wx / 2),
      bz = Math.floor(wz / 2);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const cell of bucket.get(`${bx + dx}:${bz + dz}`) ?? []) {
          const d2 = (cell.x - wx) ** 2 + (cell.z - wz) ** 2;
          if (d2 >= KERNEL_RADIUS ** 2) continue;
          const weight = (1 - d2 / KERNEL_RADIUS ** 2) ** 3;
          found.push({ cell, weight });
          total += weight;
        }
      }
    }
    return { found, total };
  };
  const heightAt = (x: number, z: number) => {
    const { found, total } = influences(x, z);
    if (total === 0) return -0.4;
    let elevation = 0;
    let landform = 0;
    for (const { cell, weight } of found) {
      elevation += cell.elevation * weight;
      landform += resolveLandform(cell.biome, x, z) * weight;
    }
    const ground = heightOfElevation(elevation / total);
    return ground + (landform / total) * Math.min(1, Math.max(0, ground / 0.06));
  };
  const surfacesAt = (x: number, z: number) => {
    const { found, total } = influences(x, z);
    const weights = SURFACES.map(() => 0);
    for (const { cell, weight } of found) {
      for (const [surface, share] of Object.entries(BIOME_SURFACES[cell.biome]) as Array<[Surface, number]>) {
        weights[SURFACES.indexOf(surface)] += (share * weight) / Math.max(total, 1e-6);
      }
    }
    return weights;
  };
  const biomeAt = (x: number, z: number) => {
    const { found } = influences(x, z);
    return found.toSorted((left, right) => right.weight - left.weight)[0]?.cell.biome ?? BiomeType.DeepOcean;
  };
  return {
    cells,
    cellAt: (col, row) => byKey.get(`${col}:${row}`),
    heightAt,
    surfacesAt,
    biomeAt,
    bounds: resolveBounds(cells),
  };
}

/** The lab's Living Biomes field (one source: the terrain verification fixture), each hex placed in its biome's band. */
function benchCells(): BiomeCell[] {
  const request = createAllBiomesTerrainRequest();
  return request.cells.map(({ col, row, biome }) => {
    const sample = Biome.sampleEnvironment(col, row, request.climate);
    const band = BIOME_BANDS[biome!];
    const { x, z } = terrainHexToWorld(col, row);
    return {
      col,
      row,
      x,
      z,
      biome: biome!,
      elevation: band.elevation[0] + (band.elevation[1] - band.elevation[0]) * (0.25 + sample.elevation * 0.5),
      moisture: band.moisture[0] + (band.moisture[1] - band.moisture[0]) * (0.25 + sample.moisture * 0.5),
    };
  });
}

/** A real map region: biome, elevation and moisture are the contract's own. */
function seededCells(): BiomeCell[] {
  const cells: BiomeCell[] = [];
  for (let row = SEEDED_REGION.minRow; row <= SEEDED_REGION.maxRow; row++) {
    for (let col = SEEDED_REGION.minCol; col <= SEEDED_REGION.maxCol; col++) {
      const { biome, elevation, moisture } = Biome.sampleEnvironment(
        col + SEEDED_OFFSET,
        row + SEEDED_OFFSET,
        SEEDED_CLIMATE,
      );
      const { x, z } = terrainHexToWorld(col, row);
      cells.push({ col, row, x, z, biome, elevation, moisture });
    }
  }
  return cells;
}

/** Monotone through the contract's levels: the waterline at the ocean level, mountains rising fastest. */
const HEIGHT_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, -0.5],
  [0.17, -0.26],
  [0.26, 0],
  [0.31, 0.05],
  [0.42, 0.12],
  [0.5, 0.2],
  [0.56, 0.3],
  [0.74, 0.7],
  [1, 1.1],
];

function heightOfElevation(elevation: number): number {
  for (let index = 1; index < HEIGHT_CURVE.length; index++) {
    const [high, highHeight] = HEIGHT_CURVE[index];
    if (elevation > high) continue;
    const [low, lowHeight] = HEIGHT_CURVE[index - 1];
    return lowHeight + ((elevation - low) / (high - low)) * (highHeight - lowHeight);
  }
  return HEIGHT_CURVE[HEIGHT_CURVE.length - 1][1];
}

/** Each biome's own landform, added to the elevation's height on dry land. */
function resolveLandform(biome: BiomeType, x: number, z: number): number {
  switch (biome) {
    case BiomeType.SubtropicalDesert:
    case BiomeType.Beach: {
      const warp = Math.sin(x * 0.31 + Math.sin(z * 0.23) * 1.7) * 1.3;
      const crest = 1 - Math.abs(Math.sin((x * 0.74 + z * 0.42) * 1.9 + warp));
      return crest * crest * (biome === BiomeType.Beach ? 0.04 : 0.16);
    }
    case BiomeType.TemperateDesert: {
      const level = hashNoise(x * 0.45, z * 0.45, 3) * 3;
      return ((Math.floor(level) + smoothstep(0.8, 1, level % 1)) / 3) * 0.22;
    }
    case BiomeType.Bare:
    case BiomeType.Scorched: {
      const ridge = 1 - Math.abs(hashNoise(x * 0.9, z * 0.9, 5) * 2 - 1);
      return ridge ** 2 * 0.3;
    }
    case BiomeType.Snow: {
      const drift = Math.sin((x * 0.5 + z * 0.86) * 2.2 + hashNoise(x * 0.4, z * 0.4, 7) * 3);
      return (drift * 0.5 + 0.5) * 0.1 + hashNoise(x * 0.6, z * 0.6, 8) * 0.12;
    }
    case BiomeType.Taiga:
    case BiomeType.Tundra:
      return hashNoise(x * 2.2, z * 2.2, 9) * 0.09;
    case BiomeType.Grassland:
    case BiomeType.Shrubland:
      return hashNoise(x * 0.6, z * 0.6, 10) * 0.12;
    case BiomeType.DeepOcean:
    case BiomeType.Ocean:
      return 0;
    default:
      return hashNoise(x * 1.0, z * 1.0, 12) * 0.12;
  }
}

/** The land hexes beside a given place where a realm and an army stand: same biome where it is land, else the coast. */
export function resolveStage(
  world: BiomeWorld,
  focus: { x: number; z: number },
): { realm: BiomeCell; army: BiomeCell } {
  const isLand = (cell?: BiomeCell) => !!cell && cell.biome !== BiomeType.Ocean && cell.biome !== BiomeType.DeepOcean;
  const byDistance = world.cells
    .filter((cell) => isLand(cell))
    .toSorted(
      (left, right) =>
        Math.hypot(left.x - focus.x, left.z - focus.z) - Math.hypot(right.x - focus.x, right.z - focus.z),
    );
  for (const army of byDistance) {
    const realm = terrainNeighborCoordinates(army.col, army.row)
      .map(({ col, row }) => world.cellAt(col, row))
      .find((cell) => isLand(cell) && cell!.biome === army.biome);
    if (realm) return { realm, army };
  }
  throw new Error("The field has no two neighbouring land hexes of one biome");
}

/** Where a biome's region sits on the field: the centre of its hexes. */
export function biomeCentre(world: BiomeWorld, biome: BiomeType): { x: number; z: number } {
  const own = world.cells.filter((cell) => cell.biome === biome);
  if (own.length === 0) throw new Error(`The field has no ${biome} hex`);
  return {
    x: own.reduce((sum, cell) => sum + cell.x, 0) / own.length,
    z: own.reduce((sum, cell) => sum + cell.z, 0) / own.length,
  };
}

function resolveBounds(cells: BiomeCell[]) {
  return {
    minX: Math.min(...cells.map((cell) => cell.x)) - 1,
    maxX: Math.max(...cells.map((cell) => cell.x)) + 1,
    minZ: Math.min(...cells.map((cell) => cell.z)) - 1,
    maxZ: Math.max(...cells.map((cell) => cell.z)) + 1,
  };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Smooth value noise (0 to 1) on world position: deterministic, no state. */
function hashNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x),
    z0 = Math.floor(z);
  const fx = smoothstep(0, 1, x - x0),
    fz = smoothstep(0, 1, z - z0);
  const corner = (cx: number, cz: number) => {
    let hash = Math.imul(cx | 0, 374761393) ^ Math.imul(cz | 0, 668265263) ^ Math.imul(seed, 1442695041);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  };
  const top = corner(x0, z0) * (1 - fx) + corner(x0 + 1, z0) * fx;
  const bottom = corner(x0, z0 + 1) * (1 - fx) + corner(x0 + 1, z0 + 1) * fx;
  return top * (1 - fz) + bottom * fz;
}
