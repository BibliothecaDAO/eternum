import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

import { terrainHexToWorld, terrainNeighborCoordinates } from "@/three/terrain/terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest } from "@/three/terrain/terrain-types";

export type Hex = { col: number; row: number };

export interface StudioTroop {
  category: TroopType;
  tier: TroopTier;
}

/**
 * A set the studio can build: its land, where each subject stands, and the order its fog clears in. Every set holds
 * the same kinds of subject, so a take or a script written for one reads on the other.
 */
export interface StudioSet {
  columns: number;
  rows: number;
  biomeAt(hex: Hex): BiomeType;
  /** The realm whose tier a call sets, and the Hyperstructure that rises on one. */
  realm: Hex;
  hyperstructure: Hex;
  /** Realms that stand at one tier for the whole shoot. */
  kingdoms: readonly { hex: Hex; level: number }[];
  /** The fights: each attacker faces the defender on the hex beside it. */
  battles: readonly { attacker: Hex; defender: Hex }[];
  /** Armies that march together, each along its own route, a hex on every call. */
  host: readonly { troop: StudioTroop; route: readonly Hex[] }[];
  /** Where the explorer starts, and the hexes it walks onto. */
  exploreStart: Hex;
  exploreRoute: readonly Hex[];
  /** The hexes each clearing of the fog uncovers, in order; a hex in none of them is never under fog. */
  reveals: readonly (readonly Hex[])[];
}

const EXPLORE_STEPS = 3;

/**
 * The stage: one stretch of land holding a subject for each shot, apart enough that a close camera on one leaves the
 * others out of frame. The south-west corner lies under fog, with an explorer on its edge.
 */
const STAGE_SET: StudioSet = (() => {
  const exploreStart = { col: 5, row: 11 };
  const exploreRoute = walkSouth(exploreStart, EXPLORE_STEPS);
  return {
    columns: 24,
    rows: 18,
    biomeAt: stageBiomeAt,
    realm: { col: 7, row: 5 },
    hyperstructure: { col: 17, row: 6 },
    kingdoms: [],
    // The defender stands on the hex beside the attacker, east of it on the same row.
    battles: [{ attacker: { col: 13, row: 12 }, defender: { col: 14, row: 12 } }],
    host: [],
    exploreStart,
    exploreRoute,
    reveals: exploreRoute.map((hex) => [hex]),
  };
})();

/** Meadow round the realm, forest and shrub between the subjects, taiga to the north-east, a dry rise by the tower. */
function stageBiomeAt({ col, row }: Hex): BiomeType {
  const x = col + Math.sin(row * 0.61) * 1.1;
  const y = row + Math.sin(col * 0.47) * 0.9;
  if (Math.hypot(x - 7, y - 5) < 3.6) return BiomeType.Grassland;
  if (Math.hypot(x - 17, y - 6) < 2.4) return BiomeType.TemperateDesert;
  if (x > 19 || y < 2) return BiomeType.Taiga;
  if (Math.hypot(x - 13.5, y - 12) < 3.2) return BiomeType.Shrubland;
  return (Math.floor(x / 3) + Math.floor(y / 3)) % 3 === 0 ? BiomeType.Shrubland : BiomeType.TemperateDeciduousForest;
}

const WORLD_COLUMNS = 76;
const WORLD_ROWS = 50;
const WORLD_CAPITAL = { col: 38, row: 25 };
const WORLD_MIST_RINGS = 7;
/** The land round the capital that stands clear before the mist lifts, in world units. */
const WORLD_CLEAR_RADIUS = 9;

/**
 * The world: a continent holding every biome the game draws, from a western sea to a scorched south-east, with a
 * capital in its meadow heart, a dozen realms at every tier, a host marching east along the heartland and a battle
 * line where the shrubland meets the desert. All of it but the capital's meadow lies under mist, which lifts in rings.
 */
const WORLD_SET: StudioSet = (() => {
  const march = (row: number, from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, step) => ({ col: from + step, row }));
  const ranks = [
    { category: TroopType.Paladin, tier: TroopTier.T3 },
    { category: TroopType.Knight, tier: TroopTier.T2 },
    { category: TroopType.Crossbowman, tier: TroopTier.T2 },
    { category: TroopType.Paladin, tier: TroopTier.T1 },
    { category: TroopType.Knight, tier: TroopTier.T3 },
    { category: TroopType.Crossbowman, tier: TroopTier.T3 },
  ];
  const HOST_FILES = 3;
  const HOST_LENGTH = 9;
  const HOST_MARCH = 6;
  const host = Array.from({ length: HOST_FILES * HOST_LENGTH }, (_, index) => {
    const file = index % HOST_FILES;
    const place = Math.floor(index / HOST_FILES);
    const start = 43 + place;
    return { troop: ranks[(file + place) % ranks.length], route: march(26 + file, start, start + HOST_MARCH) };
  });
  const battles = Array.from({ length: 6 }, (_, index) => ({
    attacker: { col: 62, row: 22 + index },
    defender: { col: 63, row: 22 + index },
  }));
  const kingdoms = [
    { hex: { col: 30, row: 21 }, level: 2 },
    { hex: { col: 45, row: 20 }, level: 1 },
    { hex: { col: 31, row: 30 }, level: 1 },
    { hex: { col: 23, row: 25 }, level: 3 },
    { hex: { col: 55, row: 19 }, level: 0 },
    { hex: { col: 41, row: 35 }, level: 2 },
    { hex: { col: 20, row: 13 }, level: 1 },
    { hex: { col: 56, row: 36 }, level: 1 },
    { hex: { col: 15, row: 34 }, level: 2 },
    { hex: { col: 50, row: 10 }, level: 0 },
    { hex: { col: 28, row: 41 }, level: 3 },
    { hex: { col: 66, row: 13 }, level: 2 },
    { hex: { col: 35, row: 8 }, level: 1 },
    { hex: { col: 68, row: 38 }, level: 0 },
  ];
  const everyHex = Array.from({ length: WORLD_COLUMNS * WORLD_ROWS }, (_, index) => ({
    col: index % WORLD_COLUMNS,
    row: Math.floor(index / WORLD_COLUMNS),
  }));
  const capital = terrainHexToWorld(WORLD_CAPITAL.col, WORLD_CAPITAL.row);
  const farthest = Math.max(...everyHex.map((hex) => distanceFrom(capital, hex)));
  const ringOf = (hex: Hex) =>
    Math.ceil(((distanceFrom(capital, hex) - WORLD_CLEAR_RADIUS) / (farthest - WORLD_CLEAR_RADIUS)) * WORLD_MIST_RINGS);
  return {
    columns: WORLD_COLUMNS,
    rows: WORLD_ROWS,
    biomeAt: worldBiomeAt,
    realm: WORLD_CAPITAL,
    hyperstructure: { col: 49, row: 31 },
    kingdoms,
    battles,
    host,
    exploreStart: { col: 36, row: 28 },
    exploreRoute: [],
    reveals: Array.from({ length: WORLD_MIST_RINGS }, (_, ring) => everyHex.filter((hex) => ringOf(hex) === ring + 1)),
  };
})();

function distanceFrom(point: { x: number; z: number }, hex: Hex): number {
  const at = terrainHexToWorld(hex.col, hex.row);
  return Math.hypot(at.x - point.x, at.z - point.z);
}

/**
 * The world's climate, west to east and north to south: a sea and its beach on the west coast; snow, tundra, bare rock
 * and taiga across the north; rain forest, deciduous forest, the capital's grassland, shrubland and a temperate desert
 * through the middle; tropical forests, a subtropical desert and scorched ground across the south.
 */
function worldBiomeAt({ col, row }: Hex): BiomeType {
  const east = (col + Math.sin(row * 0.43) * 2.2 + Math.sin(row * 0.17 + 1.3) * 1.6) / WORLD_COLUMNS;
  const south = (row + Math.sin(col * 0.37) * 1.8 + Math.sin(col * 0.13 + 0.7) * 1.4) / WORLD_ROWS;
  if (east < 0.07) return BiomeType.DeepOcean;
  if (east < 0.13) return BiomeType.Ocean;
  if (east < 0.165) return BiomeType.Beach;
  if (south < 0.1) return BiomeType.Snow;
  if (south < 0.2) return east > 0.55 && east < 0.8 ? BiomeType.Bare : BiomeType.Tundra;
  if (south < 0.32) return BiomeType.Taiga;
  if (south < 0.68) {
    if (east < 0.34) return BiomeType.TemperateRainForest;
    if (east < 0.44) return BiomeType.TemperateDeciduousForest;
    if (east < 0.64) return BiomeType.Grassland;
    if (east < 0.8) return BiomeType.Shrubland;
    return BiomeType.TemperateDesert;
  }
  if (east < 0.38) return BiomeType.TropicalRainForest;
  if (east < 0.56) return BiomeType.TropicalSeasonalForest;
  if (east < 0.8) return BiomeType.SubtropicalDesert;
  return BiomeType.Scorched;
}

export const STUDIO_SETS = { stage: STAGE_SET, world: WORLD_SET } as const;
export type StudioSetName = keyof typeof STUDIO_SETS;
export const isStudioSet = (name: string | null): name is StudioSetName =>
  name !== null && Object.hasOwn(STUDIO_SETS, name);

/** The set's terrain with its first `revealed` clearings of the fog uncovered. */
export function createStudioTerrainRequest(name: StudioSetName, revealed: number): TerrainPageRequest {
  const set = STUDIO_SETS[name];
  const fogged = new Set(set.reveals.slice(revealed).flat().map(hexKey));
  const realms = [{ hex: set.realm, level: 1 }, ...set.kingdoms];
  const occupied = new Set([set.hyperstructure, ...realms.map((realm) => realm.hex)].map(hexKey));
  const cells: TerrainCellInput[] = Array.from({ length: set.columns * set.rows }, (_, index) => {
    const hex = { col: index % set.columns, row: Math.floor(index / set.columns) };
    const biome = set.biomeAt(hex);
    const explored = !fogged.has(hexKey(hex));
    return {
      ...hex,
      biome: explored ? biome : null,
      previewBiome: biome,
      explored,
      occupied: occupied.has(hexKey(hex)),
    };
  });
  return {
    cells,
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    halo: [],
    mapCenter: 0,
    pageKey: `lab-studio:${name}:${revealed}`,
    roadSegments: [],
    settlementAnchors: realms.map(({ hex, level }, index) => ({
      ...hex,
      level: Math.max(1, level),
      structureId: `studio-realm-${index}`,
      structureType: StructureType.Realm,
    })),
    strictBiomeParity: false,
    subdivisions: 3,
  };
}

function walkSouth(start: Hex, steps: number): Hex[] {
  const route: Hex[] = [];
  let current = start;
  for (let step = 0; step < steps; step += 1) {
    current = terrainNeighborCoordinates(current.col, current.row)
      .filter((hex) => hex.row === current.row + 1)
      .toSorted((a, b) => a.col - b.col)[0];
    route.push(current);
  }
  return route;
}

const hexKey = ({ col, row }: Hex) => `${col}:${row}`;
