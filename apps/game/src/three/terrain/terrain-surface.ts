import type { Vector3 } from "three";

import type { TerrainSurfaceSample } from "./terrain-types";

export interface TerrainSurface {
  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample;
}

export const FLAT_TERRAIN_SURFACE: TerrainSurface = Object.freeze({
  sampleSurface: () => ({ biome: null, height: 0, normal: [0, 1, 0] as const }),
});

/** A hex rim of this corner radius around the origin: its six corners and its six edge middles, as (dx, dz). */
export function hexRimOffsets(cornerRadius: number): (readonly [number, number])[] {
  return Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI / 6) * index;
    const radius = cornerRadius * (index % 2 === 0 ? Math.cos(Math.PI / 6) : 1);
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as const;
  });
}

/** The highest ground at any of these (dx, dz) offsets from (x, z): something laid flat this high is buried nowhere. */
export function highestGroundAt(
  surface: TerrainSurface,
  x: number,
  z: number,
  offsets: readonly (readonly [number, number])[],
): number {
  let highest = -Infinity;
  for (const [dx, dz] of offsets) highest = Math.max(highest, surface.sampleSurface(x + dx, z + dz).height);
  return highest;
}

export function placePositionOnTerrain(position: Vector3, surface: TerrainSurface, verticalOffset = 0): Vector3 {
  position.y = surface.sampleSurface(position.x, position.z).height + verticalOffset;
  return position;
}
