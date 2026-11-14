import { TERRAIN_BIOME_DESCRIPTORS } from "@/three/terrain/terrain-palette";
import { worldHexAt, worldHexToWorld } from "@/three/world-origin";

import type { Land } from "./land-from-facts";
import type { GroundPoint } from "./map-camera";
import { animalOf, type AnimalSpecies } from "./wildlife";

/** One explored hex in so many is an animal's home. */
const HEXES_TO_A_HOME = 6;

const keyOf = (col: number, row: number) => `${col},${row}`;

/** A number of a hex's own between 0 and 1, the same on every visit, so the same hexes are homes each time. */
function lot(col: number, row: number): number {
  return Math.abs((Math.sin(col * 127.1 + row * 311.7) * 43_758.5453) % 1);
}

/** The homes of a land's animals: some of its explored hexes whose biome an animal lives in. */
export function animalHomes(land: Land): Array<{ at: GroundPoint; species: AnimalSpecies }> {
  return land.hexes.flatMap((hex) => {
    const species = hex.explored ? animalOf(hex.biome) : null;
    if (!species || lot(hex.col, hex.row) >= 1 / HEXES_TO_A_HOME) return [];
    return [{ at: worldHexToWorld(hex.col, hex.row), species }];
  });
}

/**
 * Whether a point of a land is ground an animal may walk on: an explored hex of a biome the terrain raises above the
 * sea.
 */
export function landRoamed(land: Land): (point: GroundPoint) => boolean {
  const ground = new Set(
    land.hexes
      .filter((hex) => hex.explored && TERRAIN_BIOME_DESCRIPTORS[hex.biome].baseHeight >= 0)
      .map((hex) => keyOf(hex.col, hex.row)),
  );
  return (point) => {
    const hex = worldHexAt(point.x, point.z);
    return ground.has(keyOf(hex.col, hex.row));
  };
}
