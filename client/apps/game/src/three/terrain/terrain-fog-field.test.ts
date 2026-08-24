import { Mesh } from "three";
import { describe, expect, it } from "vitest";

import { TERRAIN_FOG_CELL_CAPACITY, TERRAIN_FOG_REVEAL_DURATION_SECONDS, TerrainFogField } from "./terrain-fog-field";
import type { TerrainShroudInstance } from "./terrain-types";

describe("TerrainFogField", () => {
  it("renders every unexplored cell through one continuous bounded mist sheet", () => {
    const fog = new TerrainFogField();
    fog.update([instance(0, 0, true), instance(1, 0, false)]);

    expect(fog.getStats()).toMatchObject({
      activeReveals: 0,
      frontierInstances: 1,
      instances: 2,
      maskBytes: 4_096,
      maskResolution: 64,
      triangles: 2,
    });
    const meshes = fog.object3d.children.filter((child): child is Mesh => child instanceof Mesh);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]).toMatchObject({ frustumCulled: false, renderOrder: 10_000, visible: true });
    expect(meshes[0].material).toMatchObject({ depthTest: false, depthWrite: false, transparent: true });
    expect(meshes[0].raycast.name).toBe("disableFogRaycast");
    fog.dispose();
  });

  it("retains fog until an explored tile commit and removes it after the bounded reveal", () => {
    const fog = new TerrainFogField();
    fog.update([instance(0, 0, true), instance(1, 0, false)]);
    fog.queueReveal(0, 0);
    fog.update([instance(1, 0, false)]);

    expect(fog.getStats()).toMatchObject({ activeReveals: 1, instances: 2, triangles: 2 });
    fog.updateAnimation(TERRAIN_FOG_REVEAL_DURATION_SECONDS / 2);
    expect(fog.getStats().activeReveals).toBe(1);
    expect(fog.resolveIncomingFogCells([instance(1, 0, false)])).toHaveLength(2);
    for (let frame = 0; frame < 20; frame += 1) fog.updateAnimation(0.05);
    expect(fog.getStats()).toMatchObject({ activeReveals: 0, instances: 1, triangles: 2 });
    fog.update([]);
    expect(fog.getStats()).toMatchObject({ instances: 0, maskBytes: 0, maskResolution: 0, triangles: 0 });
    fog.dispose();
  });

  it("fails loudly before the bounded fog-cell contract can overflow", () => {
    const fog = new TerrainFogField();
    const instances = Array.from({ length: TERRAIN_FOG_CELL_CAPACITY + 1 }, (_, index) => instance(index, 0, false));

    expect(() => fog.update(instances)).toThrow(`exceeded ${TERRAIN_FOG_CELL_CAPACITY} cells`);
    fog.dispose();
  });
});

function instance(col: number, row: number, frontier: boolean): TerrainShroudInstance {
  return {
    col,
    frontier,
    frontierDirection: frontier ? [1, 0] : [0, 0],
    pageKey: "fixture",
    row,
    seed: 0.5,
    tint: [0.1, 0.2, 0.3],
    worldX: col * 1.732,
    worldY: 0.1,
    worldZ: row * 1.5,
  };
}
