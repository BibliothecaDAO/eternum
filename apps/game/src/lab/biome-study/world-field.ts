import { Biome, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";

import {
  findNearestTerrainHex,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "@/three/terrain/terrain-coordinates";

/**
 * The world as one function. A tile's biome, elevation and moisture are what the contract decides from its coordinates
 * and the game's climate seeds, so the whole map is known when the game starts: every height and surface weight below
 * is a pure function of (climate, world position) and the per-tile facts, never of which page or chunk asks.
 */

/** Surface families the ground shader paints; a biome is a blend of families plus a tint. */
export const SURFACE_FAMILIES = [
  "sand",
  "badlands",
  "grass",
  "forest",
  "taiga",
  "tundra",
  "rock",
  "snow",
  "ash",
  "scrub",
] as const;
export type SurfaceFamily = (typeof SURFACE_FAMILIES)[number];
export const SURFACE_FAMILY_COUNT = SURFACE_FAMILIES.length;

interface BiomeLook {
  families: Partial<Record<SurfaceFamily, number>>;
  tint: string;
  /** The landform the relief carves: what makes a desert a desert before any colour. */
  landform: Landform;
}

type Landform =
  | "seabed"
  | "shore"
  | "dunes"
  | "mesas"
  | "meadow"
  | "scrub"
  | "hummocks"
  | "moraine"
  | "polygons"
  | "crags"
  | "peaks"
  | "volcanic";

/** One source for every biome's look in the study; the biome list itself is the game's. */
export const BIOME_LOOKS: Readonly<Record<Exclude<BiomeType, BiomeType.None | BiomeType.Underground>, BiomeLook>> = {
  [BiomeType.DeepOcean]: { families: { sand: 0.4, rock: 0.6 }, tint: "#5b6a6a", landform: "seabed" },
  [BiomeType.Ocean]: { families: { sand: 0.8, rock: 0.2 }, tint: "#9c9478", landform: "seabed" },
  [BiomeType.Beach]: { families: { sand: 1 }, tint: "#e8d8aa", landform: "shore" },
  [BiomeType.SubtropicalDesert]: { families: { sand: 1 }, tint: "#e2b062", landform: "dunes" },
  [BiomeType.TemperateDesert]: { families: { badlands: 1 }, tint: "#c27650", landform: "mesas" },
  [BiomeType.Grassland]: { families: { grass: 1 }, tint: "#9cb556", landform: "meadow" },
  [BiomeType.Shrubland]: { families: { scrub: 1 }, tint: "#b3a66a", landform: "scrub" },
  [BiomeType.TemperateDeciduousForest]: { families: { forest: 1 }, tint: "#6f883a", landform: "hummocks" },
  [BiomeType.TemperateRainForest]: { families: { forest: 1 }, tint: "#4f8257", landform: "hummocks" },
  [BiomeType.TropicalSeasonalForest]: {
    families: { forest: 0.65, grass: 0.35 },
    tint: "#949a44",
    landform: "hummocks",
  },
  [BiomeType.TropicalRainForest]: { families: { forest: 1 }, tint: "#2f7d4b", landform: "hummocks" },
  [BiomeType.Taiga]: { families: { taiga: 1 }, tint: "#557366", landform: "moraine" },
  [BiomeType.Tundra]: { families: { tundra: 1 }, tint: "#8f8a5e", landform: "polygons" },
  [BiomeType.Bare]: { families: { rock: 1 }, tint: "#9da3a8", landform: "crags" },
  [BiomeType.Snow]: { families: { snow: 1 }, tint: "#f0f4f7", landform: "peaks" },
  [BiomeType.Scorched]: { families: { ash: 1 }, tint: "#3d3533", landform: "volcanic" },
};

/** The contract's elevation thresholds (biome.cairo, mirrored in core's biome.ts): each biome's elevation band. */
const ELEVATION_BANDS: Readonly<Record<keyof typeof BIOME_LOOKS, readonly [number, number]>> = {
  [BiomeType.DeepOcean]: [0, 0.17],
  [BiomeType.Ocean]: [0.17, 0.26],
  [BiomeType.Beach]: [0.26, 0.31],
  [BiomeType.SubtropicalDesert]: [0.31, 0.42],
  [BiomeType.TropicalRainForest]: [0.31, 0.42],
  [BiomeType.TropicalSeasonalForest]: [0.31, 0.42],
  [BiomeType.Grassland]: [0.31, 0.5],
  [BiomeType.TemperateDesert]: [0.42, 0.56],
  [BiomeType.TemperateDeciduousForest]: [0.42, 0.5],
  [BiomeType.TemperateRainForest]: [0.42, 0.5],
  [BiomeType.Shrubland]: [0.5, 0.56],
  [BiomeType.Taiga]: [0.5, 0.56],
  [BiomeType.Scorched]: [0.56, 1],
  [BiomeType.Bare]: [0.56, 1],
  [BiomeType.Tundra]: [0.56, 1],
  [BiomeType.Snow]: [0.56, 1],
};

export const WATER_LEVEL = -0.06;

export interface StudyCellInput {
  biome: BiomeType;
  col: number;
  row: number;
}

export interface StudyCell {
  biome: keyof typeof BIOME_LOOKS;
  col: number;
  row: number;
  x: number;
  z: number;
  /** The contract's elevation, inside the biome's band. */
  elevation: number;
  moisture: number;
  /** The tile's ground level in world units: water below 0, mountains near 1. */
  level: number;
}

export interface FieldSample {
  height: number;
  /** Ground level without landform detail: what the terraced tiles step on. */
  level: number;
  families: Float32Array;
  tint: [number, number, number];
  moisture: number;
  owner: StudyCell | undefined;
}

const BLEND_RADIUS = 1.75;
const PAD_INNER = 0.42;
const PAD_OUTER = 0.86;

export class StudyField {
  private readonly cells = new Map<string, StudyCell>();
  private readonly seed: number;
  private readonly centers = new Map<StudyCell, number>();

  constructor(inputs: readonly StudyCellInput[], climate: BiomeClimateConfig) {
    this.seed = mixSeed(climate.elevation_seed ?? 0, climate.moisture_seed ?? 0);
    for (const input of inputs) {
      if (!(input.biome in BIOME_LOOKS)) continue;
      const biome = input.biome as keyof typeof BIOME_LOOKS;
      const environment = Biome.sampleEnvironment(input.col, input.row, climate);
      const elevation = placeInBand(environment.elevation, ELEVATION_BANDS[biome]);
      const center = terrainHexToWorld(input.col, input.row);
      this.cells.set(key(input.col, input.row), {
        biome,
        col: input.col,
        row: input.row,
        x: center.x,
        z: center.z,
        elevation,
        moisture: environment.moisture,
        level: groundLevel(elevation),
      });
    }
  }

  cell(col: number, row: number): StudyCell | undefined {
    return this.cells.get(key(col, row));
  }

  allCells(): IterableIterator<StudyCell> {
    return this.cells.values();
  }

  /** Everything the relief and the painter need at one world point. Pure in (field, x, z). */
  sample(x: number, z: number): FieldSample {
    const ownerHex = findNearestTerrainHex(x, z);
    const owner = this.cell(ownerHex.col, ownerHex.row);
    const candidates = [
      owner,
      ...terrainNeighborCoordinates(ownerHex.col, ownerHex.row).map((n) => this.cell(n.col, n.row)),
    ];
    const families = new Float32Array(SURFACE_FAMILY_COUNT);
    const tint: [number, number, number] = [0, 0, 0];
    let level = 0;
    let detail = 0;
    let moisture = 0;
    let total = 0;
    let visualTotal = 0;
    let nearest = Infinity;
    for (const cell of candidates) if (cell) nearest = Math.min(nearest, distanceSquared(cell, x, z));
    for (const cell of candidates) {
      if (!cell) continue;
      const d2 = distanceSquared(cell, x, z);
      const weight = blendWeight(Math.sqrt(d2));
      if (weight > 0) {
        total += weight;
        level += cell.level * weight;
        moisture += cell.moisture * weight;
        detail += landformHeight(BIOME_LOOKS[cell.biome].landform, x, z, this.seed) * weight;
      }
      // Surfaces meet in a narrow verge at the hex edge; heights blend over the wider kernel above.
      const visual = Math.exp(-(d2 - nearest) / 0.12);
      visualTotal += visual;
      const look = BIOME_LOOKS[cell.biome];
      for (const [family, share] of Object.entries(look.families)) {
        families[SURFACE_FAMILIES.indexOf(family as SurfaceFamily)] += share * visual;
      }
      const [r, g, b] = hexToLinear(look.tint);
      tint[0] += r * visual;
      tint[1] += g * visual;
      tint[2] += b * visual;
    }
    if (total === 0 || visualTotal === 0) {
      return { height: WATER_LEVEL - 0.4, level: WATER_LEVEL - 0.4, families, tint, moisture: 0, owner };
    }
    for (let index = 0; index < families.length; index++) families[index] /= visualTotal;
    tint[0] /= visualTotal;
    tint[1] /= visualTotal;
    tint[2] /= visualTotal;
    level /= total;
    detail /= total;
    // Each tile keeps a level pad at its centre so armies and buildings stand on even ground. The pad sits at the
    // relief's own height there, so a tile never sinks into a bowl below its rim.
    const pad = owner ? smoothstep(PAD_INNER, PAD_OUTER, Math.sqrt(distanceSquared(owner, x, z))) : 1;
    const padHeight = owner ? this.centerHeight(owner) : level + detail;
    const height = padHeight + (level + detail - padHeight) * pad;
    return { height, level, families, tint, moisture: moisture / total, owner };
  }

  /** The relief at a tile's centre: its own level and landform, flattened toward its neighbours' as they blend. */
  private centerHeight(cell: StudyCell): number {
    const cached = this.centers.get(cell);
    if (cached !== undefined) return cached;
    let total = 0;
    let height = 0;
    for (const neighbor of [
      cell,
      ...terrainNeighborCoordinates(cell.col, cell.row).map((n) => this.cell(n.col, n.row)),
    ]) {
      if (!neighbor) continue;
      const weight = blendWeight(Math.sqrt(distanceSquared(neighbor, cell.x, cell.z)));
      if (weight === 0) continue;
      total += weight;
      height +=
        (neighbor.level + landformHeight(BIOME_LOOKS[neighbor.biome].landform, cell.x, cell.z, this.seed)) * weight;
    }
    const center = height / total;
    this.centers.set(cell, center);
    return center;
  }

  /** Where a tile's model stands: its centre on the relief. */
  standHeight(col: number, row: number): number {
    const center = terrainHexToWorld(col, row);
    return this.sample(center.x, center.z).height;
  }
}

/** World-space landform relief by biome, in world units. Deterministic in (x, z, seed). */
function landformHeight(landform: Landform, x: number, z: number, seed: number): number {
  switch (landform) {
    case "seabed":
      return (fbm(x * 0.35, z * 0.35, seed, 3) - 0.5) * 0.12;
    case "shore":
      return (fbm(x * 0.9, z * 0.9, seed + 1, 2) - 0.5) * 0.03;
    case "dunes": {
      // Wind-aligned crests, warped so they curve like barchan fields.
      const warp = (fbm(x * 0.25, z * 0.25, seed + 2, 2) - 0.5) * 3.2;
      const phase = (x * 0.78 + z * 0.42) * 1.35 + warp;
      const crest = 1 - Math.abs(Math.sin(phase));
      return (Math.pow(crest, 1.6) - 0.35) * 0.28 + (fbm(x * 0.6, z * 0.6, seed + 3, 2) - 0.5) * 0.06;
    }
    case "mesas": {
      // Terraced badlands: noise quantised into ledges, the steps softened so they read as eroded.
      const n = fbm(x * 0.32, z * 0.32, seed + 4, 3);
      const steps = 4;
      const t = n * steps;
      const ledge = Math.floor(t) + smoothstep(0.72, 1, t - Math.floor(t));
      return (ledge / steps - 0.45) * 0.34;
    }
    case "meadow":
      return (fbm(x * 0.42, z * 0.42, seed + 5, 3) - 0.5) * 0.12;
    case "scrub": {
      const rocks = Math.max(0, fbm(x * 1.1, z * 1.1, seed + 6, 2) - 0.62) * 0.5;
      return (fbm(x * 0.5, z * 0.5, seed + 7, 3) - 0.5) * 0.09 + rocks;
    }
    case "hummocks":
      return (fbm(x * 0.55, z * 0.55, seed + 8, 3) - 0.5) * 0.1 + (fbm(x * 1.6, z * 1.6, seed + 9, 2) - 0.5) * 0.04;
    case "moraine": {
      const ridge = 1 - Math.abs(fbm(x * 0.4, z * 0.4, seed + 10, 3) * 2 - 1);
      return (ridge - 0.6) * 0.16 + (fbm(x * 1.4, z * 1.4, seed + 11, 2) - 0.5) * 0.05;
    }
    case "polygons":
      return (fbm(x * 0.3, z * 0.3, seed + 12, 2) - 0.5) * 0.06;
    case "crags": {
      const ridge = 1 - Math.abs(fbm(x * 0.48, z * 0.48, seed + 13, 4) * 2 - 1);
      return (Math.pow(ridge, 2.2) - 0.25) * 0.42;
    }
    case "peaks": {
      const ridge = 1 - Math.abs(fbm(x * 0.36, z * 0.36, seed + 14, 4) * 2 - 1);
      return (Math.pow(ridge, 2.6) - 0.2) * 0.62;
    }
    case "volcanic": {
      const ridge = 1 - Math.abs(fbm(x * 0.42, z * 0.42, seed + 15, 3) * 2 - 1);
      const vents = Math.max(0, 0.2 - Math.abs(fbm(x * 0.9, z * 0.9, seed + 16, 2) - 0.5)) * 0.6;
      return (Math.pow(ridge, 1.8) - 0.3) * 0.36 - vents;
    }
  }
}

/** The tile's ground level from the contract's elevation: the coast at 0, mountains rising steeply past 0.56. */
function groundLevel(elevation: number): number {
  if (elevation < 0.17) return lerp(-0.42, -0.3, elevation / 0.17);
  if (elevation < 0.26) return lerp(-0.3, -0.13, (elevation - 0.17) / 0.09);
  if (elevation < 0.31) return lerp(-0.01, 0.05, (elevation - 0.26) / 0.05);
  if (elevation < 0.56) return lerp(0.05, 0.32, (elevation - 0.31) / 0.25);
  return lerp(0.36, 0.9, (elevation - 0.56) / 0.44);
}

/**
 * The game always draws a biome's tiles inside its band. Lab fixtures paint biomes by hand over the climate's
 * elevation, so a value outside the band folds back into it, deterministically.
 */
function placeInBand(elevation: number, [low, high]: readonly [number, number]): number {
  if (elevation >= low && elevation <= high) return elevation;
  const fraction = (elevation * 7.31) % 1;
  return low + (high - low) * (0.15 + fraction * 0.7);
}

function blendWeight(distance: number): number {
  const t = Math.max(0, 1 - distance / BLEND_RADIUS);
  return t * t * t;
}

function distanceSquared(cell: StudyCell, x: number, z: number): number {
  return (cell.x - x) ** 2 + (cell.z - z) ** 2;
}

function key(col: number, row: number): string {
  return `${col}:${row}`;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixSeed(a: number, b: number): number {
  return (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
}

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
}

/** Fractal value noise in [0, 1]. */
function fbm(x: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let norm = 0;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave++) {
    sum += valueNoise(x * frequency, z * frequency, seed + octave * 101) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

const linearCache = new Map<string, [number, number, number]>();
/** An sRGB hex colour as the linear RGB the shaders blend. */
export function hexToLinear(hex: string): [number, number, number] {
  const cached = linearCache.get(hex);
  if (cached) return cached;
  const value = parseInt(hex.slice(1), 16);
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const linear: [number, number, number] = [
    toLinear((value >> 16) & 255),
    toLinear((value >> 8) & 255),
    toLinear(value & 255),
  ];
  linearCache.set(hex, linear);
  return linear;
}
