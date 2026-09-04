import { describe, expect, it } from "vitest";

import { BENCHMARK_HEX_CELLS } from "./procedural-character-benchmark-simulation";
import {
  createProceduralWorldGymTerrainRequest,
  resolveProceduralWorldGymTerrainCenter,
} from "./procedural-world-gym-environment";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";

describe("procedural world gym environment", () => {
  it("builds a bounded all-biome field around the 100-character route grid", () => {
    const request = createProceduralWorldGymTerrainRequest();
    const center = resolveProceduralWorldGymTerrainCenter(request);
    const terrainCenters = request.cells.map(({ col, row }) => terrainHexToWorld(col, row));
    const worldBounds = {
      maxX: Math.max(...terrainCenters.map(({ x }) => x - center.x)),
      maxZ: Math.max(...terrainCenters.map(({ z }) => z - center.z)),
      minX: Math.min(...terrainCenters.map(({ x }) => x - center.x)),
      minZ: Math.min(...terrainCenters.map(({ z }) => z - center.z)),
    };

    expect(request.cells).toHaveLength(196);
    expect(new Set(request.cells.map(({ biome }) => biome)).size).toBe(16);
    expect(request.cells.every(({ explored }) => explored)).toBe(true);
    expect(request.propDensityMultiplier).toBe(0.7);
    expect(BENCHMARK_HEX_CELLS.every(({ x }) => x > worldBounds.minX && x < worldBounds.maxX)).toBe(true);
    expect(BENCHMARK_HEX_CELLS.every(({ z }) => z > worldBounds.minZ && z < worldBounds.maxZ)).toBe(true);
  });
});
