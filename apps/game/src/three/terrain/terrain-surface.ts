import type { Vector3 } from "three";

import type { TerrainSurfaceSample } from "./terrain-types";

export interface TerrainSurface {
  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample;
}

export const FLAT_TERRAIN_SURFACE: TerrainSurface = Object.freeze({
  sampleSurface: () => ({ biome: null, height: 0, normal: [0, 1, 0] as const }),
});

export function placePositionOnTerrain(position: Vector3, surface: TerrainSurface, verticalOffset = 0): Vector3 {
  position.y = surface.sampleSurface(position.x, position.z).height + verticalOffset;
  return position;
}
