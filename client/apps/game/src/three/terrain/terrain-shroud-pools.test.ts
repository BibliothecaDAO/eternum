import { InstancedMesh } from "three";
import { describe, expect, it } from "vitest";

import {
  TERRAIN_SHROUD_POOL_CAPACITY,
  TERRAIN_SHROUD_REVEAL_DURATION_SECONDS,
  TerrainShroudPools,
} from "./terrain-shroud-pools";
import type { TerrainShroudInstance } from "./terrain-types";

describe("TerrainShroudPools", () => {
  it("pools unknown and frontier cells into two bounded draw surfaces", () => {
    const pools = new TerrainShroudPools();
    pools.update([instance(0, 0, true), instance(1, 0, false)]);

    expect(pools.getStats()).toMatchObject({ activeReveals: 0, frontierInstances: 1, instances: 2 });
    const meshes = pools.object3d.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
    expect(meshes).toHaveLength(1);
    expect(meshes.every((mesh) => mesh.raycast.name === "disableShroudRaycast")).toBe(true);
    pools.dispose();
  });

  it("retains cover until an explored tile commit and then removes it after the bounded reveal", () => {
    const pools = new TerrainShroudPools();
    pools.update([instance(0, 0, true), instance(1, 0, false)]);
    pools.queueReveal(0, 0);
    pools.update([instance(1, 0, false)]);

    expect(pools.getStats()).toMatchObject({ activeReveals: 1, instances: 2 });
    pools.updateAnimation(TERRAIN_SHROUD_REVEAL_DURATION_SECONDS / 2);
    const mesh = pools.object3d.getObjectByName("terrain-exploration-shroud") as InstancedMesh;
    const reveal = mesh.geometry.getAttribute("terrainShroudReveal");
    expect(Math.max(...Array.from(reveal.array))).toBeGreaterThan(0);
    for (let frame = 0; frame < 20; frame += 1) pools.updateAnimation(0.05);
    expect(pools.getStats()).toMatchObject({ activeReveals: 0, instances: 1 });
    pools.dispose();
  });

  it("fails loudly before instance buffers can overflow", () => {
    const pools = new TerrainShroudPools();
    const instances = Array.from({ length: TERRAIN_SHROUD_POOL_CAPACITY + 1 }, (_, index) => instance(index, 0, false));

    expect(() => pools.update(instances)).toThrow(`exceeded ${TERRAIN_SHROUD_POOL_CAPACITY} instances`);
    pools.dispose();
  });
});

function instance(col: number, row: number, frontier: boolean): TerrainShroudInstance {
  return {
    col,
    frontier,
    pageKey: "fixture",
    row,
    seed: 0.5,
    tint: [0.1, 0.2, 0.3],
    worldX: col * 1.7,
    worldY: 0.1,
    worldZ: row * 1.5,
  };
}
