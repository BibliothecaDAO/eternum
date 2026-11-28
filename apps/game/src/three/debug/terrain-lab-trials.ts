import type { BiomeType } from "@bibliothecadao/types/terrain";
import { Color, InstancedMesh, Object3D, type BufferGeometry, type Material } from "three";

import type { ProceduralTerrain } from "../terrain/procedural-terrain";
import { terrainHexToWorld } from "../terrain/terrain-coordinates";
import { TERRAIN_WATER_LEVEL } from "../terrain/terrain-water";

/** The lab's trial of real ground (blades, leaves, stones, snow and dunes with depth) is opted into with `?real=1`. */
export function terrainLabRealGroundRequested(): boolean {
  return new URLSearchParams(window.location.search).get("real") === "1";
}

export interface GroundTile {
  col: number;
  row: number;
  biome: BiomeType;
}

export interface GroundSpot {
  x: number;
  y: number;
  z: number;
  biome: BiomeType;
  /** How tall the thing may stand here: 1 inland, less by the water. */
  clearance: number;
  random: () => number;
}

export const TILE_APOTHEM = Math.sqrt(3) / 2;
/** Nothing stands on ground this low: it is the wet edge of the shore, or under the water. */
const SHORE_HEIGHT = TERRAIN_WATER_LEVEL + 0.05;
/**
 * Nothing stands within the first distance of the water, and what stands within the second is kept low: seen from
 * the map's camera a tall blade at the land's edge would otherwise be drawn over the water behind it.
 */
const SHORE_RINGS = { bare: 0.6, low: 0.9 };
const SHORE_LOW = 0.35;
const RING = Array.from({ length: 6 }, (_, side) => [Math.cos((side * Math.PI) / 3), Math.sin((side * Math.PI) / 3)]);

/** How tall a thing may stand at a point, from 0 by the water to 1 inland. */
function shoreClearance(terrain: ProceduralTerrain, x: number, z: number): number {
  const dryWithin = (reach: number) =>
    RING.every(([aside, ahead]) => terrain.sampleHeight(x + aside * reach, z + ahead * reach) >= SHORE_HEIGHT);
  if (terrain.sampleHeight(x, z) < SHORE_HEIGHT || !dryWithin(SHORE_RINGS.bare)) return 0;
  return dryWithin(SHORE_RINGS.low) ? 1 : SHORE_LOW;
}

/** The same scatter on every load, so two captures of a trial can be compared. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Scatter {
  name: string;
  geometry: BufferGeometry;
  material: Material;
  terrain: ProceduralTerrain;
  /** The height things stand at: the terrain's, or higher where a blanket lies on it. */
  heightAt: (x: number, z: number) => number;
  tiles: readonly GroundTile[];
  seed: number;
  /** How many a tile of this biome is given; fewer stand where a try falls outside the tile or on another biome. */
  countOf: (biome: BiomeType) => number;
  /** Sets one instance's place, turn and size on `piece`, and its colour on `tint`. */
  place: (piece: Object3D, tint: Color, spot: GroundSpot) => void;
}

/** One instanced mesh of things standing on the ground of the tiles that ask for them, or null if none does. */
export function createScatter(scatter: Scatter): InstancedMesh | null {
  const capacity = scatter.tiles.reduce((sum, tile) => sum + scatter.countOf(tile.biome), 0);
  if (capacity === 0) return null;
  const mesh = new InstancedMesh(scatter.geometry, scatter.material, capacity);
  mesh.name = scatter.name;
  const random = seededRandom(scatter.seed);
  const piece = new Object3D();
  const tint = new Color();
  let placed = 0;
  for (const tile of scatter.tiles) {
    const middle = terrainHexToWorld(tile.col, tile.row);
    for (let index = scatter.countOf(tile.biome); index > 0; index -= 1) {
      const x = (random() * 2 - 1) * TILE_APOTHEM;
      const z = random() * 2 - 1;
      if (Math.abs(z) > 1 - Math.abs(x) / Math.sqrt(3)) continue;
      const ground = scatter.terrain.sampleSurface(middle.x + x, middle.z + z);
      if (ground.biome !== tile.biome) continue;
      const clearance = shoreClearance(scatter.terrain, middle.x + x, middle.z + z);
      if (clearance === 0) continue;
      piece.rotation.set(0, 0, 0);
      piece.scale.setScalar(1);
      const spot = { x: middle.x + x, z: middle.z + z };
      scatter.place(piece, tint, {
        ...spot,
        y: scatter.heightAt(spot.x, spot.z),
        biome: tile.biome,
        clearance,
        random,
      });
      piece.updateMatrix();
      mesh.setMatrixAt(placed, piece.matrix);
      mesh.setColorAt(placed, tint);
      placed += 1;
    }
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}
