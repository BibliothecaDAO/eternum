import type { Vector3 } from "three";

import type { BiomeType } from "@bibliothecadao/types/terrain";
import type { TerrainSurfaceSample } from "./terrain-types";
import { isTerrainWaterBiome, TERRAIN_WATER_LEVEL } from "./terrain-water";

export const TERRAIN_GROUND_HEIGHT = 0;

export const groundHeightOfCell = ({
  explored,
  biome,
  ethereal,
}: {
  explored: boolean;
  biome: BiomeType | null;
  ethereal: boolean;
}): number => {
  if (!explored || ethereal) return TERRAIN_GROUND_HEIGHT;
  return isTerrainWaterBiome(biome) ? TERRAIN_WATER_LEVEL : TERRAIN_GROUND_HEIGHT;
};

export interface TerrainSurface {
  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample;
  sampleHeight(worldX: number, worldZ: number): number;
}

export const FLAT_TERRAIN_SURFACE: TerrainSurface = Object.freeze({
  sampleSurface: () => ({ biome: null, height: 0, normal: [0, 1, 0] as const }),
  sampleHeight: () => 0,
});

export function placePositionOnTerrain(position: Vector3, surface: TerrainSurface, verticalOffset = 0): Vector3 {
  position.y = surface.sampleHeight(position.x, position.z) + verticalOffset;
  return position;
}
