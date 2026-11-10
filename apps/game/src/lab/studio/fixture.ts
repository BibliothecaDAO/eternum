import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

import { CAMP_MODEL_PATH, ChestModelPath, RiftModelPath } from "@/three/constants/scene-constants";
import {
  TERRAIN_HEX_HORIZONTAL_SPACING,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "@/three/terrain/terrain-coordinates";
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
  /** Hyperstructures that stand complete for the whole shoot. */
  hyperstructures: readonly Hex[];
  /** Realms that stand at one tier for the whole shoot, the viewer's own or another player's. */
  kingdoms: readonly { hex: Hex; level: number; ours: boolean }[];
  /** The fights: each attacker faces the defender on the hex beside it. */
  battles: readonly { attacker: Hex; defender: Hex }[];
  /** Camps, Essence Rifts and chests standing on the map, each drawn from its model. */
  sites: readonly { hex: Hex; model: string }[];
  /** The armies that live on the map: each walks its route, a hex at a time, to its end. */
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
  /** The hex of its route it stands on when the set is built. */
  startAt: number;
  /** Seconds it waits before its first step, so the map's armies do not all step at once. */
  wait: number;
  /** It uncovers the fog ahead of each step, as an exploring army does. */
  explores?: boolean;
  /** The guard that holds this hex of its route: it strikes it from the hex before, then walks on over it. */
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
    hyperstructures: [],
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

const MATCH_COLUMNS = 64;
const MATCH_ROWS = 56;
const MATCH_CENTRE = { col: 32, row: 28 };
/** A Blitz match's layout, as the settlement grid deals it at its spacing of 6 (`settlement_grid.cairo`). */
const REALM_DISTANCE = 6;
const HYPERSTRUCTURE_DISTANCE = 12;
/** For each of the six seats round the centre: the direction its realms lie in, and the one their triangle opens in. */
const SEAT_DIRECTIONS = [
  [1, 3],
  [3, 5],
  [5, 1],
  [2, 4],
  [4, 0],
  [0, 2],
] as const;
/** The seat whose two armies the match follows; its realms fly the viewer's colours. */
const OUR_SEAT = 4;
/** The step of the road the bandits hold. */
const AMBUSH_STEP = 6;
const TRAVELLER: StudioTroop = { category: TroopType.Paladin, tier: TroopTier.T2 };

/**
 * The world: a Blitz match of six players. A Hyperstructure stands on the centre tile and six more on the ring round
 * it; each player's three realms stand in a triangle between them; camps, Essence Rifts and a relic chest lie where
 * exploring found them, and the land not yet explored is under fog. Two armies of one player walk the road from their
 * realm to the centre, through the two bandits that hold it by a camp.
 */
const WORLD_SET: StudioSet = (() => {
  const seats = SEAT_DIRECTIONS.map(([out, open]) => {
    const first = stride(stride(MATCH_CENTRE, out, REALM_DISTANCE), open, REALM_DISTANCE / 2);
    const second = stride(first, out, 3);
    return [first, second, stride(second, open, 3)];
  });
  const [near, far, home] = seats[OUR_SEAT];
  const kingdoms = [
    ...[near, far].map((hex, index) => ({ hex, level: 2 - index, ours: true })),
    ...seats
      .filter((_, seat) => seat !== OUR_SEAT)
      .flatMap((realms, seat) => realms.map((hex, index) => ({ hex, level: (seat + index) % 4, ours: false }))),
  ];
  // The ring's last site is the one a call raises; the others and the centre's stand from the first frame.
  const [unclaimed, ...ring] = SEAT_DIRECTIONS.map((_, direction) =>
    stride(MATCH_CENTRE, (direction + 2) % 6, HYPERSTRUCTURE_DISTANCE),
  );
  // The road: from the home realm to the foot of the centre's Hyperstructure, a lane for each army, with a bandit
  // holding each lane where a camp stands beside it.
  const road = hexLine(stride(stride(home, 1, 1), 0, 1), stride(MATCH_CENTRE, 0, 1));
  const lanes = [road, road.map((hex) => stride(hex, 0, 1))];
  const orders: StudioOrder[] = lanes.map((route, lane) => ({
    troop: TRAVELLER,
    route,
    startAt: 0,
    wait: 1 + lane * 0.4,
    raids: route[AMBUSH_STEP],
  }));
  const sites = [
    { hex: stride(lanes[1][AMBUSH_STEP], 0, 2), model: CAMP_MODEL_PATH },
    { hex: stride(stride(MATCH_CENTRE, 3, 5), 2, 2), model: CAMP_MODEL_PATH },
    { hex: stride(stride(MATCH_CENTRE, 1, 4), 0, 5), model: CAMP_MODEL_PATH },
    { hex: stride(stride(MATCH_CENTRE, 0, 5), 5, 3), model: RiftModelPath },
    { hex: stride(stride(MATCH_CENTRE, 2, 9), 3, 3), model: RiftModelPath },
    { hex: stride(stride(MATCH_CENTRE, 3, 3), 4, 1), model: ChestModelPath },
  ];
  return {
    columns: MATCH_COLUMNS,
    rows: MATCH_ROWS,
    biomeAt: matchBiomeAt,
    realm: home,
    hyperstructure: unclaimed,
    hyperstructures: [MATCH_CENTRE, ...ring],
    kingdoms,
    battles: [],
    sites,
    orders,
    exploreStart: stride(home, 3, 1),
    exploreRoute: [],
    isFogged: isUnexplored,
    reveals: [],
  };
})();

/** The land no army of the match has explored yet: everything past a ragged edge round the players' realms. */
function isUnexplored(hex: Hex): boolean {
  const reach = 16.5 + Math.sin(hex.col * 0.9) * 1.1 + Math.sin(hex.row * 0.7) * 1.1;
  return (
    distanceFrom(terrainHexToWorld(MATCH_CENTRE.col, MATCH_CENTRE.row), hex) / TERRAIN_HEX_HORIZONTAL_SPACING > reach
  );
}

/** The hex `steps` away in one of the grid's six directions, counted as the game counts them. */
function stride(hex: Hex, direction: number, steps: number): Hex {
  let current = hex;
  for (let step = 0; step < steps; step += 1) current = terrainNeighborCoordinates(current.col, current.row)[direction];
  return current;
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

function distanceFrom(point: { x: number; z: number }, hex: Hex): number {
  const at = terrainHexToWorld(hex.col, hex.row);
  return Math.hypot(at.x - point.x, at.z - point.z);
}

/**
 * The match's land, in patches a few hexes across as a generated map has them: how high and how wet a hex is choose
 * its biome, from sea and beach through forests, grassland and deserts up to bare rock and snow.
 */
function matchBiomeAt({ col, row }: Hex): BiomeType {
  const { x, z } = terrainHexToWorld(col, row);
  const wave = (a: number, b: number, c: number) => Math.sin(x * a + z * b + c);
  const high = 0.5 + (wave(0.21, 0.07, 3.5) + wave(-0.09, 0.24, 4.2) + wave(0.33, -0.29, 4.9) * 0.6) / 5.2;
  const wet = 0.5 + (wave(0.11, -0.19, 1.2) + wave(0.26, 0.13, 3.3) + wave(-0.31, 0.36, 0.2) * 0.6) / 5.2;
  if (high < 0.1) return BiomeType.DeepOcean;
  if (high < 0.16) return BiomeType.Ocean;
  if (high < 0.2) return BiomeType.Beach;
  if (high > 0.78) {
    if (wet < 0.3) return BiomeType.Scorched;
    if (wet < 0.45) return BiomeType.Bare;
    return wet < 0.6 ? BiomeType.Tundra : BiomeType.Snow;
  }
  if (high > 0.62) {
    if (wet < 0.36) return BiomeType.TemperateDesert;
    return wet < 0.6 ? BiomeType.Shrubland : BiomeType.Taiga;
  }
  if (high > 0.45) {
    if (wet < 0.3) return BiomeType.TemperateDesert;
    if (wet < 0.52) return BiomeType.Grassland;
    return wet < 0.7 ? BiomeType.TemperateDeciduousForest : BiomeType.TemperateRainForest;
  }
  if (wet < 0.3) return BiomeType.SubtropicalDesert;
  if (wet < 0.45) return BiomeType.Grassland;
  return wet < 0.66 ? BiomeType.TropicalSeasonalForest : BiomeType.TropicalRainForest;
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
  const standing = [
    set.hyperstructure,
    ...set.hyperstructures,
    ...realms.map((realm) => realm.hex),
    ...set.sites.map((site) => site.hex),
  ];
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
