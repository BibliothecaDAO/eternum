import { InstancedMesh, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { TERRAIN_WATER_INTERACTION_CAPACITY, TerrainWaterInteractionPool } from "./terrain-water-interactions";

describe("terrain water interactions", () => {
  it("renders moving wakes and idle ripples in one deterministic instanced pool", () => {
    const pool = new TerrainWaterInteractionPool();
    pool.update([
      { entityId: 9, isMoving: false, worldX: 4, worldZ: 2, yaw: 0 },
      { entityId: 2, isMoving: true, worldX: 1, worldZ: 3, yaw: Math.PI / 2 },
    ]);
    const mesh = pool.object3d.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const position = new Vector3();
    mesh.getMatrixAt(0, matrix);
    position.setFromMatrixPosition(matrix);

    expect(pool.getStats()).toEqual({ instances: 2, triangles: 4, wakes: 1 });
    expect(position.x).toBeCloseTo(0.38);
    expect(position.z).toBeCloseTo(3);
    expect(mesh.count).toBe(2);
    expect(mesh.visible).toBe(true);
    pool.dispose();
  });

  it("hides the bounded pool when quality disables interactions", () => {
    const pool = new TerrainWaterInteractionPool();
    pool.update([{ entityId: 1, isMoving: true, worldX: 0, worldZ: 0, yaw: 0 }]);
    pool.setStrength(0);

    expect(pool.getStats()).toEqual({ instances: 0, triangles: 0, wakes: 0 });
    pool.setStrength(1);
    expect(pool.getStats()).toEqual({ instances: 1, triangles: 2, wakes: 1 });
    pool.dispose();
  });

  it("caps oversized input without allowing invalid interaction values", () => {
    const pool = new TerrainWaterInteractionPool();
    pool.update(
      Array.from({ length: TERRAIN_WATER_INTERACTION_CAPACITY + 1 }, (_, entityId) => ({
        entityId,
        isMoving: false,
        worldX: 0,
        worldZ: 0,
        yaw: 0,
      })),
    );
    expect(pool.getStats().instances).toBe(TERRAIN_WATER_INTERACTION_CAPACITY);
    expect(() => pool.update([{ entityId: 1, isMoving: true, worldX: Number.NaN, worldZ: 0, yaw: 0 }])).toThrow(
      "Terrain water interaction requires finite values",
    );
    pool.dispose();
  });
});
