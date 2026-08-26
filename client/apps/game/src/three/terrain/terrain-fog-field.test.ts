import { BufferAttribute, DataTexture, Mesh, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TERRAIN_FOG_CELL_CAPACITY, TERRAIN_FOG_REVEAL_DURATION_SECONDS, TerrainFogField } from "./terrain-fog-field";
import type { TerrainShroudInstance } from "./terrain-types";

describe("TerrainFogField", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders every unexplored cell through one continuous bounded mist sheet", () => {
    const fog = new TerrainFogField();
    fog.update([instance(0, 0, true), instance(1, 0, false)]);

    expect(fog.getStats()).toMatchObject({
      activeReveals: 0,
      frontierInstances: 1,
      instances: 2,
      maskBytes: 1_024,
      maskHeight: 32,
      maskWidth: 32,
      triangles: 2,
    });
    const meshes = fog.object3d.children.filter((child): child is Mesh => child instanceof Mesh);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]).toMatchObject({ frustumCulled: false, renderOrder: 10_000, visible: true });
    expect(meshes[0].material).toMatchObject({ depthTest: false, depthWrite: false, transparent: true });
    expect(meshes[0].raycast.name).toBe("disableFogRaycast");
    fog.dispose();
  });

  it("registers the mask's minimum-z source row to the fog sheet's minimum-z world edge", () => {
    const fog = new TerrainFogField();
    fog.update([instance(0, 0, false), instance(0, 4, false)]);

    const mesh = fog.object3d.children[0] as Mesh;
    const texture = (fog as unknown as { maskTexture: DataTexture }).maskTexture;
    const sourceMinimumZUv = texture.flipY ? 1 : 0;
    const sourceMinimumZWorld = resolveWorldPositionAtUvY(mesh, sourceMinimumZUv);
    const sheetMinimumZ = mesh.position.z - mesh.scale.z / 2;

    expect(sourceMinimumZWorld.z).toBeCloseTo(sheetMinimumZ, 6);
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
    expect(fog.getStats()).toMatchObject({ instances: 0, maskBytes: 0, maskHeight: 0, maskWidth: 0, triangles: 0 });
    fog.dispose();
  });

  it("replaces and disposes the texture only when adaptive mask dimensions change", () => {
    const disposeTexture = vi.spyOn(DataTexture.prototype, "dispose");
    const fog = new TerrainFogField();
    fog.update([instance(0, 0, false)]);
    disposeTexture.mockClear();

    const wideFog = [instance(0, 0, false), instance(80, 0, false)];
    fog.update(wideFog);
    const wideStats = fog.getStats();

    expect(wideStats.maskWidth).toBeGreaterThan(wideStats.maskHeight);
    expect(wideStats.maskBytes).toBe(wideStats.maskWidth * wideStats.maskHeight);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
    fog.update(wideFog);
    expect(disposeTexture).toHaveBeenCalledTimes(1);

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

function resolveWorldPositionAtUvY(mesh: Mesh, uvY: number): Vector3 {
  mesh.updateMatrixWorld(true);
  const positions = mesh.geometry.getAttribute("position") as BufferAttribute;
  const uvs = mesh.geometry.getAttribute("uv") as BufferAttribute;
  const vertexIndex = Array.from({ length: uvs.count }, (_, index) => index).find((index) => uvs.getY(index) === uvY);
  if (vertexIndex === undefined) throw new Error(`Fog sheet did not contain a vertex at UV y=${uvY}`);
  return new Vector3().fromBufferAttribute(positions, vertexIndex).applyMatrix4(mesh.matrixWorld);
}
