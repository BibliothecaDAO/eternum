import type { BiomeType } from "@bibliothecadao/types/terrain";
import { Group, type Material, type Mesh, type Object3D } from "three";

import type { ProceduralTerrain } from "../terrain/procedural-terrain";
import { createBlankets, createSnowFlakes } from "./terrain-lab-blanket";
import { createBlades, createLeaves, createStones } from "./terrain-lab-ground-cover";
import type { GroundTile } from "./terrain-lab-trials";

/**
 * A lab trial of real ground: every biome's tiles dressed with what truly stands and lies there (blades of grass,
 * fallen leaves, stones, snow and dunes with depth), to judge the look before anything is built for the game.
 */
export interface TerrainLabRealGround {
  object3d: Object3D;
  dispose: () => void;
}

export function createTerrainLabRealGround(
  terrain: ProceduralTerrain,
  cells: ReadonlyArray<{ col: number; row: number; biome?: BiomeType | null }>,
): TerrainLabRealGround {
  const tiles = cells.filter((cell): cell is GroundTile => cell.biome != null);
  const blankets = createBlankets(terrain, tiles);
  const ground = { terrain, tiles, heightAt: blankets.heightAt };
  const parts: Mesh[] = [
    ...blankets.meshes,
    createBlades(ground),
    createLeaves(ground),
    createStones(ground),
    createSnowFlakes(terrain, tiles, blankets.heightAt),
  ].filter((part) => part !== null);
  const group = new Group();
  group.name = "terrain-lab-real-ground";
  group.add(...parts);
  return {
    object3d: group,
    dispose: () => {
      for (const part of parts) {
        part.geometry.dispose();
        (part.material as Material).dispose();
      }
    },
  };
}
