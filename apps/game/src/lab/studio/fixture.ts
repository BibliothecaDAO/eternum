import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";

import { terrainNeighborCoordinates } from "@/three/terrain/terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest } from "@/three/terrain/terrain-types";

type Hex = { col: number; row: number };

const COLUMNS = 24;
const ROWS = 18;
const EXPLORE_STEPS = 3;

/**
 * The studio's set: one stretch of land holding a subject for each shot, apart enough that a close camera on one
 * leaves the others out of frame. The south-west corner lies under fog, with an explorer on its edge.
 */
export const STUDIO_PLACES = (() => {
  const exploreStart = { col: 5, row: 11 };
  const exploreRoute = walkSouth(exploreStart, EXPLORE_STEPS);
  return {
    realm: { col: 7, row: 5 },
    hyperstructure: { col: 17, row: 6 },
    attacker: { col: 13, row: 12 },
    // The hex beside the attacker, east of it on the same row.
    defender: { col: 14, row: 12 },
    exploreStart,
    exploreRoute,
  };
})();

export type StudioPlace = Exclude<keyof typeof STUDIO_PLACES, "exploreRoute">;

/** The set's terrain with the first `revealed` steps of the explorer's route uncovered. */
export function createStudioTerrainRequest(revealed: number): TerrainPageRequest {
  const uncovered = new Set(STUDIO_PLACES.exploreRoute.slice(0, revealed).map(hexKey));
  const occupied = new Set([STUDIO_PLACES.realm, STUDIO_PLACES.hyperstructure].map(hexKey));
  const cells: TerrainCellInput[] = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
    const hex = { col: index % COLUMNS, row: Math.floor(index / COLUMNS) };
    const biome = studioBiomeAt(hex);
    const explored = !isUnderFog(hex) || uncovered.has(hexKey(hex));
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
    pageKey: `lab-studio:${revealed}`,
    roadSegments: [],
    settlementAnchors: [
      { ...STUDIO_PLACES.realm, level: 1, structureId: "studio-realm", structureType: StructureType.Realm },
    ],
    strictBiomeParity: false,
    subdivisions: 3,
  };
}

export const STUDIO_EXPLORE_STEPS = EXPLORE_STEPS;

function isUnderFog({ col, row }: Hex): boolean {
  if (col === STUDIO_PLACES.exploreStart.col && row === STUDIO_PLACES.exploreStart.row) return false;
  return row >= 12 + Math.sin(col * 0.9) * 0.6 && col <= 10 + Math.sin(row * 0.7);
}

/** Meadow round the realm, forest and shrub between the subjects, taiga to the north-east, a dry rise by the tower. */
export function studioBiomeAt({ col, row }: Hex): BiomeType {
  const x = col + Math.sin(row * 0.61) * 1.1;
  const y = row + Math.sin(col * 0.47) * 0.9;
  if (Math.hypot(x - 7, y - 5) < 3.6) return BiomeType.Grassland;
  if (Math.hypot(x - 17, y - 6) < 2.4) return BiomeType.TemperateDesert;
  if (x > 19 || y < 2) return BiomeType.Taiga;
  if (Math.hypot(x - 13.5, y - 12) < 3.2) return BiomeType.Shrubland;
  return (Math.floor(x / 3) + Math.floor(y / 3)) % 3 === 0 ? BiomeType.Shrubland : BiomeType.TemperateDeciduousForest;
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
