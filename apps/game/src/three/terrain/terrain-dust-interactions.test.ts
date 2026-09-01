import { InstancedMesh, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  TERRAIN_DUST_EMITTER_CAPACITY,
  TERRAIN_DUST_INTERACTION_CAPACITY,
  TerrainDustInteractionPool,
} from "./terrain-dust-interactions";

describe("terrain dust interactions", () => {
  it("emits deterministic alternating ground-contact puffs in one bounded draw", () => {
    const pool = new TerrainDustInteractionPool();
    pool.sync([
      { entityId: 9, groundY: 0.2, isMoving: true, surface: "grass", worldX: 4, worldZ: 2, yaw: 0 },
      { entityId: 2, groundY: 0.1, isMoving: true, surface: "dry", worldX: 1, worldZ: 3, yaw: 0 },
    ]);
    pool.update(0);
    const mesh = pool.object3d.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    const position = new Vector3();
    mesh.getMatrixAt(0, matrix);
    position.setFromMatrixPosition(matrix);

    expect(pool.getStats()).toEqual({ activeParticles: 2, capacity: 128, drawCalls: 1, emitters: 2, triangles: 4 });
    expect(position.x).toBeCloseTo(0.89);
    expect(position.y).toBeCloseTo(0.118);
    expect(position.z).toBeCloseTo(2.84);
    pool.dispose();
  });

  it("expires particles, removes idle emitters, and quality-gates the draw", () => {
    const pool = new TerrainDustInteractionPool();
    const moving = [{ entityId: 1, groundY: 0, isMoving: true, surface: "dry" as const, worldX: 0, worldZ: 0, yaw: 0 }];
    pool.sync(moving);
    pool.update(0);
    expect(pool.getStats().activeParticles).toBe(1);

    pool.sync([{ ...moving[0], isMoving: false }]);
    for (let frame = 0; frame < 20; frame += 1) pool.update(0.05);
    expect(pool.getStats()).toMatchObject({ activeParticles: 0, drawCalls: 0, emitters: 0, triangles: 0 });

    pool.sync(moving);
    pool.update(0);
    pool.setStrength(0);
    expect(pool.getStats()).toMatchObject({ activeParticles: 0, drawCalls: 0, emitters: 0 });
    pool.dispose();
  });

  it("caps emitters and active particles without accepting invalid values", () => {
    const pool = new TerrainDustInteractionPool();
    pool.sync(
      Array.from({ length: TERRAIN_DUST_EMITTER_CAPACITY + 1 }, (_, entityId) => ({
        entityId,
        groundY: 0,
        isMoving: true,
        surface: "dry" as const,
        worldX: 0,
        worldZ: 0,
        yaw: 0,
      })),
    );
    pool.update(0);

    expect(pool.getStats()).toMatchObject({
      activeParticles: TERRAIN_DUST_INTERACTION_CAPACITY,
      emitters: TERRAIN_DUST_EMITTER_CAPACITY,
      triangles: TERRAIN_DUST_INTERACTION_CAPACITY * 2,
    });
    expect(() =>
      pool.sync([{ entityId: 1, groundY: 0, isMoving: true, surface: "dry", worldX: Number.NaN, worldZ: 0, yaw: 0 }]),
    ).toThrow("Terrain dust interaction requires finite values");
    pool.dispose();
  });
});
