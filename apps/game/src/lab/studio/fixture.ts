import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

import { CAMP_MODEL_PATH, VILLAGE_MODEL_PATH } from "@/three/constants/scene-constants";
import { FALLEN_REALM_RUIN_PATH, FRONTIER_BEASTS } from "@/three/structures/frontier-beast";
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
  /** Camps, villages, ruins and beasts standing on the map, each drawn from its model. */
  sites: readonly { hex: Hex; model: string }[];
  /** The armies that live on the map: each walks its route, a hex at a time, and turns back at its end. */
  orders: readonly StudioOrder[];
  /** Where the explorer starts, and the hexes it walks onto. */
  exploreStart: Hex;
  exploreRoute: readonly Hex[];
  /** Whether a hex lies under fog before anything is uncovered. */
  isFogged(hex: Hex): boolean;
  /** The hexes each clearing of the fog uncovers, in order. */
  reveals: readonly (readonly Hex[])[];
}

/** One army's standing order. */
export interface StudioOrder {
  troop: StudioTroop;
  /** The hexes it walks, each beside the last. */
  route: readonly Hex[];
  /** The hex of its route it stands on when the set is built, and which way it is walking. */
  startAt: number;
  heading: 1 | -1;
  /** Seconds it waits before its first step, so the map's armies do not all step at once. */
  wait: number;
  /** It uncovers the fog ahead of each step, as an exploring army does. */
  explores?: boolean;
  /** The guard it attacks from the last hex of its route: the guard's hex, beside that one. */
  raids?: Hex;
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
    sites: [],
    orders: [],
    exploreStart,
    exploreRoute,
    isFogged: (hex) => exploreRoute.some((step) => hexKey(step) === hexKey(hex)),
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
const KNIGHT: StudioTroop = { category: TroopType.Knight, tier: TroopTier.T1 };
const WORLD_RANKS: readonly StudioTroop[] = [
  { category: TroopType.Paladin, tier: TroopTier.T2 },
  { category: TroopType.Knight, tier: TroopTier.T2 },
  { category: TroopType.Crossbowman, tier: TroopTier.T1 },
  { category: TroopType.Paladin, tier: TroopTier.T3 },
  { category: TroopType.Knight, tier: TroopTier.T3 },
  { category: TroopType.Crossbowman, tier: TroopTier.T3 },
  { category: TroopType.Paladin, tier: TroopTier.T1 },
  { category: TroopType.Crossbowman, tier: TroopTier.T2 },
];

/**
 * The world: a continent holding every biome the game draws, from a western sea to a scorched south-east, with a
 * capital in its meadow heart and fourteen realms at every tier. It is lived in: armies walk the roads between
 * realms and out to the camps, villages, ruins and beasts round them, raiders fall on the camps' guards, and
 * explorers push into the fog that stands along the world's edge.
 */
const WORLD_SET: StudioSet = (() => {
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
    { hex: { col: 66, row: 37 }, level: 0 },
  ];
  const realms = [WORLD_CAPITAL, ...kingdoms.map(({ hex }) => hex)];
  const beasts = Object.values(FRONTIER_BEASTS).map(({ path }) => path);
  const camps = [
    { col: 60, row: 25 },
    { col: 49, row: 39 },
    { col: 25, row: 16 },
    { col: 37, row: 16 },
  ];
  const sites = [
    ...camps.map((hex) => ({ hex, model: CAMP_MODEL_PATH })),
    ...[
      { col: 34, row: 27 },
      { col: 43, row: 28 },
      { col: 26, row: 33 },
      { col: 51, row: 24 },
      { col: 18, row: 22 },
      { col: 60, row: 31 },
    ].map((hex) => ({ hex, model: VILLAGE_MODEL_PATH })),
    ...[
      { col: 64, row: 41 },
      { col: 59, row: 43 },
      { col: 44, row: 9 },
      { col: 12, row: 42 },
    ].map((hex) => ({ hex, model: FALLEN_REALM_RUIN_PATH })),
    ...[
      { col: 63, row: 43 },
      { col: 68, row: 31 },
      { col: 47, row: 43 },
      { col: 58, row: 9 },
      { col: 22, row: 37 },
      { col: 27, row: 9 },
      { col: 53, row: 30 },
      { col: 36, row: 40 },
    ].map((hex, index) => ({ hex, model: beasts[index % beasts.length] })),
  ];
  // The roads: each is walked both ways, the way back a row to the south, with an army every few hexes.
  const roads: [from: number, to: number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 6],
    [0, 5],
    [1, 4],
    [2, 5],
    [4, 9],
    [5, 12],
    [3, 7],
    [4, 12],
    [6, 8],
    [8, 11],
    [3, 9],
    [1, 13],
    [2, 10],
    [6, 11],
    [5, 10],
    [8, 14],
  ];
  const orders: StudioOrder[] = [];
  const troop = () => WORLD_RANKS[orders.length % WORLD_RANKS.length];
  for (const [from, to] of roads) {
    const out = hexLine(beside(realms[from], realms[to]), beside(realms[to], realms[from]));
    const south = ({ col, row }: Hex) => ({ col, row: row + 1 });
    const back = hexLine(south(out.at(-1)!), south(out[0]));
    for (const route of [out, back])
      for (let startAt = 1 + (orders.length % 3); startAt < route.length - 1; startAt += 5)
        orders.push({ troop: troop(), route, startAt, heading: 1, wait: (orders.length % 9) * 0.23 });
  }
  // The raids: two guards stand before each camp, and a raider walks in on each from the nearest realm.
  camps.forEach((camp, index) => {
    const home = nearest(realms, camp);
    for (const side of [0, 1]) {
      const guard = { col: camp.col - 1, row: camp.row + side };
      const from = { col: guard.col - 1, row: guard.row };
      const route = hexLine(beside(home, from), from);
      orders.push({
        troop: KNIGHT,
        route,
        startAt: Math.max(0, route.length - 5),
        heading: 1,
        wait: 5.4 + index * 3 + side,
        raids: guard,
      });
    }
  });
  // The explorers: each walks out from a border realm into the fog along the eastern and southern edges.
  const exploring = [
    hexLine({ col: 67, row: 20 }, { col: 73, row: 20 }),
    hexLine({ col: 62, row: 44 }, { col: 62, row: 48 }),
  ];
  const reveals: Hex[][] = [];
  const cleared = new Set<string>();
  const steps = Math.max(...exploring.map((route) => route.length));
  for (let step = 1; step < steps; step += 1)
    for (const route of exploring) {
      const hex = route[step];
      if (!hex) continue;
      const uncovered = [hex, ...terrainNeighborCoordinates(hex.col, hex.row)].filter(
        (near) => isWorldEdge(near) && !cleared.has(hexKey(near)),
      );
      for (const near of uncovered) cleared.add(hexKey(near));
      if (isWorldEdge(hex)) reveals.push(uncovered);
    }
  exploring.forEach((route, index) =>
    orders.push({ troop: KNIGHT, route, startAt: 0, heading: 1, wait: 0.3 + index * 1.2, explores: true }),
  );
  return {
    columns: WORLD_COLUMNS,
    rows: WORLD_ROWS,
    biomeAt: worldBiomeAt,
    realm: WORLD_CAPITAL,
    hyperstructure: { col: 49, row: 31 },
    kingdoms,
    battles: [],
    sites,
    orders,
    exploreStart: { col: 36, row: 28 },
    exploreRoute: [],
    isFogged: isWorldEdge,
    reveals,
  };
})();

/** The fog along the world's edge: a ragged band a few hexes deep on every side. */
function isWorldEdge({ col, row }: Hex): boolean {
  const depth = 3.5 + Math.sin(col * 0.5) * 1.2 + Math.sin(row * 0.7) * 1.2;
  return Math.min(col, row, WORLD_COLUMNS - 1 - col, WORLD_ROWS - 1 - row) < depth;
}

/** The hexes from one to another, each beside the last, as straight as the grid allows. */
function hexLine(from: Hex, to: Hex): Hex[] {
  const goal = terrainHexToWorld(to.col, to.row);
  const route = [from];
  while (hexKey(route.at(-1)!) !== hexKey(to)) {
    const here = route.at(-1)!;
    route.push(
      terrainNeighborCoordinates(here.col, here.row).toSorted(
        (a, b) => distanceFrom(goal, a) - distanceFrom(goal, b),
      )[0],
    );
  }
  return route;
}

/** The hex beside `hex` on the side `towards` lies. */
function beside(hex: Hex, towards: Hex): Hex {
  return hexLine(hex, towards)[1];
}

function nearest(hexes: readonly Hex[], to: Hex): Hex {
  const goal = terrainHexToWorld(to.col, to.row);
  return hexes.toSorted((a, b) => distanceFrom(goal, a) - distanceFrom(goal, b))[0];
}

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
  const uncovered = new Set(set.reveals.slice(0, revealed).flat().map(hexKey));
  const realms = [{ hex: set.realm, level: 1 }, ...set.kingdoms];
  const standing = [set.hyperstructure, ...realms.map((realm) => realm.hex), ...set.sites.map((site) => site.hex)];
  const occupied = new Set(standing.map(hexKey));
  const cells: TerrainCellInput[] = Array.from({ length: set.columns * set.rows }, (_, index) => {
    const hex = { col: index % set.columns, row: Math.floor(index / set.columns) };
    const biome = set.biomeAt(hex);
    const explored = !set.isFogged(hex) || uncovered.has(hexKey(hex));
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

function hexKey({ col, row }: Hex): string {
  return `${col}:${row}`;
}
