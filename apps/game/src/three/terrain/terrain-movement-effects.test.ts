import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import { TerrainMovementEffects, resolveTerrainDustSurface } from "./terrain-movement-effects";

describe("terrain movement effects", () => {
  it("routes one consolidated movement presentation into water, dust, or no ground effect", () => {
    const resolveBiome = vi.fn(() => BiomeType.Bare);
    const effects = new TerrainMovementEffects(resolveBiome);
    effects.sync([
      movement(1, "naval", true),
      movement(2, "naval", false),
      movement(3, "ground", true),
      movement(4, "ground", false),
      movement(5, "airborne", true),
    ]);
    effects.update(0);

    expect(effects.getStats()).toEqual({
      drawCalls: 2,
      dust: { activeParticles: 1, capacity: 128, drawCalls: 1, emitters: 1, triangles: 2 },
      triangles: 6,
      water: { instances: 2, triangles: 4, wakes: 1 },
    });
    expect(resolveBiome).toHaveBeenCalledOnce();
    effects.dispose();
  });

  it("caches ground classification until an actor moves a meaningful distance", () => {
    const resolveBiome = vi.fn(() => BiomeType.Grassland);
    const effects = new TerrainMovementEffects(resolveBiome);
    effects.sync([movement(1, "ground", true)]);
    effects.sync([{ ...movement(1, "ground", true), worldX: 0.5 }]);
    effects.sync([{ ...movement(1, "ground", true), worldX: 0.8 }]);

    expect(resolveBiome).toHaveBeenCalledTimes(2);
    effects.dispose();
  });

  it("maps dry, grassy, damp, snowy, and watery biomes explicitly", () => {
    expect(resolveTerrainDustSurface(BiomeType.SubtropicalDesert)).toBe("dry");
    expect(resolveTerrainDustSurface(BiomeType.Grassland)).toBe("grass");
    expect(resolveTerrainDustSurface(BiomeType.TemperateRainForest)).toBe("damp");
    expect(resolveTerrainDustSurface(BiomeType.Snow)).toBeNull();
    expect(resolveTerrainDustSurface(BiomeType.Ocean)).toBeNull();
  });

  it("bounds terrain classification work before synchronizing oversized crowds", () => {
    const resolveBiome = vi.fn(() => BiomeType.Bare);
    const effects = new TerrainMovementEffects(resolveBiome);
    effects.sync(Array.from({ length: 300 }, (_, entityId) => movement(entityId, "ground", true)));
    effects.update(0);

    expect(resolveBiome).toHaveBeenCalledTimes(256);
    expect(effects.getStats().dust).toMatchObject({ activeParticles: 128, emitters: 256, triangles: 256 });
    effects.dispose();
  });
});

function movement(entityId: number, mode: "airborne" | "ground" | "naval", isMoving: boolean) {
  return { entityId, isMoving, mode, worldX: 0, worldY: 0, worldZ: 0, yaw: 0 } as const;
}
