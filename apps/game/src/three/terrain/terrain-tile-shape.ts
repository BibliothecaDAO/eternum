import { BiomeType } from "@bibliothecadao/types/terrain";

type Sample = (x: number, z: number, salt: string) => number;

/** The tile's middle stays flat so an army or a structure always stands level on it. */
const FLAT_CENTER = 0.3;
const RELIEF_EDGE = 0.8;
/** Stepped tiles meet their neighbours across a short rim: a smooth minimum this sharp, in world units. */
const RIM_SHARPNESS = 0.045;
const PLATEAU_SCALE = 2.4;
const PLATEAU_JITTER = 0.06;

/** Each biome's own landform, in world units, before the flat middle is kept. */
export function resolveTileRelief(biome: BiomeType, x: number, z: number, sample: Sample): number {
  switch (biome) {
    case BiomeType.SubtropicalDesert: {
      const warp = sample(x * 0.35, z * 0.35, "tile-dune-warp") * 2.4;
      const crest = 1 - Math.abs(Math.sin((x * 0.82 + z * 0.46) * 3.6 + warp));
      return crest * crest * 0.32;
    }
    case BiomeType.TemperateDesert:
    case BiomeType.Bare: {
      const steps = 3;
      const level = sample(x * 0.5, z * 0.5, "tile-mesa") * steps;
      const terrace = Math.floor(level) + smoothstep(0.82, 1, level - Math.floor(level));
      return (terrace / steps) * 0.42;
    }
    case BiomeType.Scorched: {
      const ridge = 1 - Math.abs(sample(x * 1.1, z * 1.1, "tile-crust") * 2 - 1);
      return ridge ** 3 * 0.36;
    }
    case BiomeType.Taiga:
    case BiomeType.Tundra:
      return (sample(x * 2.4, z * 2.4, "tile-hummock") - 0.5) * 0.16;
    case BiomeType.Snow: {
      const drift = Math.sin((x * 0.5 + z * 0.86) * 2.2 + sample(x * 0.4, z * 0.4, "tile-drift") * 3);
      return (drift * 0.5 + 0.5) * 0.09;
    }
    case BiomeType.TemperateDeciduousForest:
    case BiomeType.TemperateRainForest:
    case BiomeType.TropicalSeasonalForest:
    case BiomeType.TropicalRainForest:
      return (sample(x * 1.1, z * 1.1, "tile-mound") - 0.5) * 0.28;
    case BiomeType.Grassland:
    case BiomeType.Shrubland:
      return (sample(x * 0.7, z * 0.7, "tile-roll") - 0.5) * 0.2;
    default:
      return 0;
  }
}

/** 0 in the tile's flat middle, 1 from where its own landform may rise. */
export function resolveTileReliefReach(distanceFromCenter: number): number {
  return smoothstep(FLAT_CENTER, RELIEF_EDGE, distanceFromCenter);
}

/** A tile's own plateau: its biome's height, raised, plus a small per-tile step so neighbours read as tiles. */
export function resolveTilePlateau(baseHeight: number, col: number, row: number): number {
  return baseHeight * PLATEAU_SCALE + (tileHash(col, row) - 0.5) * 2 * PLATEAU_JITTER;
}

/**
 * How much a tile's plateau counts at a point, from its centre distance against the nearest centre: 1 on its own tile,
 * shared evenly on an edge or a corner. A function of position alone, so the tiles either side of an edge agree.
 */
export function resolveTilePlateauWeight(distance: number, nearestDistance: number): number {
  return Math.exp(-(distance - nearestDistance) / RIM_SHARPNESS);
}

function tileHash(col: number, row: number): number {
  let hash = Math.imul(col | 0, 374761393) ^ Math.imul(row | 0, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Height drawn from the contract's elevation (0 to 1), monotone through its biome levels: deep ocean (< 0.17) lowest,
 * beaches (0.26 to 0.31) crossing the water line, mountains (> 0.56) rising fastest. The same elevation picks the biome,
 * so a coast slopes into its sea and a peak stands above its foothills.
 */
const SEED_HEIGHT_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, -0.42],
  [0.17, -0.24],
  [0.26, -0.09],
  [0.31, 0.02],
  [0.42, 0.1],
  [0.5, 0.2],
  [0.56, 0.32],
  [1, 1.02],
];

export function resolveSeedHeight(elevation: number): number {
  for (let index = 1; index < SEED_HEIGHT_CURVE.length; index++) {
    const [high, highHeight] = SEED_HEIGHT_CURVE[index];
    if (elevation > high) continue;
    const [low, lowHeight] = SEED_HEIGHT_CURVE[index - 1];
    return lowHeight + ((elevation - low) / (high - low)) * (highHeight - lowHeight);
  }
  return SEED_HEIGHT_CURVE[SEED_HEIGHT_CURVE.length - 1][1];
}
