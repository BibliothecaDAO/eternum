import { BufferAttribute, DataTexture, Mesh, PerspectiveCamera, Scene, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TERRAIN_FOG_CELL_CAPACITY, TERRAIN_FOG_REVEAL_DURATION_SECONDS, TerrainFogField } from "./terrain-fog-field";
import { buildTerrainFogMask, type TerrainFogMask } from "./terrain-fog-mask";
import type { TerrainShroudInstance } from "./terrain-types";

describe("TerrainFogField", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the streaming backdrop inside a bounded camera neighbourhood while covering the far view", () => {
    const fog = new TerrainFogField();
    fog.enableStreaming();
    const mesh = fog.object3d.children[0] as Mesh;
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 65);
    const renderer = {} as Parameters<Mesh["onBeforeRender"]>[0];
    for (const [x, z] of [
      [0, 0],
      [250, -150],
      [-200, 400],
    ]) {
      camera.position.set(x, 30, z);
      camera.lookAt(x, 0, z - 20);
      camera.updateMatrixWorld();
      mesh.onBeforeRender(renderer, new Scene(), camera, mesh.geometry, mesh.material as never, null!);
      mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      expect(bounds.min.x).toBeLessThan(x - camera.far);
      expect(bounds.max.x).toBeGreaterThan(x + camera.far);
      expect(bounds.min.z).toBeLessThan(z - camera.far);
      expect(bounds.max.z).toBeGreaterThan(z + camera.far);
      expect(bounds.max.x - bounds.min.x).toBeLessThan(200);
      expect(bounds.max.y).toBeCloseTo(0, 6);
    }
    fog.dispose();
  });

  it("keeps one fog sheet over unloaded ground even when all resident terrain is explored", () => {
    const fog = new TerrainFogField();
    fog.enableStreaming();
    fog.setPage("fixture", [instance(0, 0, false)]);
    fog.commit();
    fog.removePage("fixture");
    fog.commit();
    expect(fog.getStats()).toMatchObject({ instances: 0, triangles: 2 });
    expect(fog.object3d.children).toHaveLength(1);
    const maskTexture = (fog as unknown as { maskTexture: DataTexture }).maskTexture;
    expect(Array.from(maskTexture.image.data as Uint8Array).every((value) => value === 0)).toBe(true);
    fog.dispose();
  });

  it("renders every unexplored cell through one continuous bounded mist sheet", () => {
    const fog = new TerrainFogField();
    fog.setPage("fixture", [instance(0, 0, true), instance(1, 0, false)]);
    fog.commit();

    expect(fog.getStats()).toMatchObject({
      activeReveals: 0,
      frontierInstances: 1,
      instances: 2,
      maskBytes: 1_024,
      maskHeight: 32,
      maskWidth: 32,
      triangles: 2,
    });
    expect(fog.getMetrics()).toEqual({ fullRebuilds: 1, pageWrites: 0, texelsWritten: 0 });
    const meshes = fog.object3d.children.filter((child): child is Mesh => child instanceof Mesh);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]).toMatchObject({ frustumCulled: false, renderOrder: -1_000, visible: true });
    expect(meshes[0].material).toMatchObject({ depthTest: false, depthWrite: false, transparent: false });
    expect(meshes[0].position.y).toBe(0);
    expect(meshes[0].raycast.name).toBe("disableFogRaycast");
    fog.dispose();
  });

  it("keeps tile coverage unchanged while ambient mist moves", () => {
    const fog = new TerrainFogField();
    fog.setPage("fixture", [instance(0, 0, true), instance(1, 0, false)]);
    fog.commit();
    const texture = (fog as unknown as { maskTexture: DataTexture }).maskTexture;
    const before = Uint8Array.from(texture.image.data as Uint8Array);
    const version = texture.version;
    for (let frame = 0; frame < 120; frame += 1) fog.updateAnimation(1 / 60);
    expect(texture.image.data).toEqual(before);
    expect(texture.version).toBe(version);
    fog.dispose();
  });

  it("registers the mask's minimum-z source row to the fog sheet's minimum-z world edge", () => {
    const fog = new TerrainFogField();
    fog.setPage("fixture", [instance(0, 0, false), instance(0, 4, false)]);
    fog.commit();

    const mesh = fog.object3d.children[0] as Mesh;
    const texture = (fog as unknown as { maskTexture: DataTexture }).maskTexture;
    const sourceMinimumZUv = texture.flipY ? 1 : 0;
    const sourceMinimumZWorld = resolveWorldPositionAtUvY(mesh, sourceMinimumZUv);
    const sheetMinimumZ = mesh.position.z - mesh.scale.z / 2;

    expect(sourceMinimumZWorld.z).toBeCloseTo(sheetMinimumZ, 6);
    fog.dispose();
  });

  it("starts a bounded material reveal only when the explored tile commits", () => {
    const fog = new TerrainFogField();
    fog.setPage("fixture", [instance(0, 0, true), instance(1, 0, false)]);
    fog.commit();
    fog.queueReveal(0, 0);
    fog.setPage("fixture", [instance(1, 0, false)]);
    fog.commit();

    expect(fog.getStats()).toMatchObject({ activeReveals: 1, instances: 1, triangles: 2 });
    fog.updateAnimation(TERRAIN_FOG_REVEAL_DURATION_SECONDS / 2);
    expect(fog.getStats().activeReveals).toBe(1);
    expect(fog.resolveIncomingFogCells([instance(1, 0, false)])).toHaveLength(1);
    for (let frame = 0; frame < 20; frame += 1) fog.updateAnimation(0.05);
    expect(fog.getStats()).toMatchObject({ activeReveals: 0, instances: 1, triangles: 2 });
    fog.removePage("fixture");
    fog.commit();
    expect(fog.getStats()).toMatchObject({ instances: 0, maskBytes: 0, maskHeight: 0, maskWidth: 0, triangles: 0 });
    fog.dispose();
  });

  it("rewrites only a changed page's sub-rect and matches a whole-window build", () => {
    const fog = new TerrainFogField();
    const west = block("west", 0, 5);
    const east = block("east", 8, 13);
    fog.setPage("west", west);
    fog.setPage("east", east);
    fog.commit();
    const area = fog.getStats().maskWidth * fog.getStats().maskHeight;

    const changedWest = withExploredCell(west, 2, 2);
    fog.setPage("west", changedWest);
    fog.commit();

    expect(fog.getMetrics()).toMatchObject({ fullRebuilds: 1, pageWrites: 1 });
    expect(fog.getMetrics().texelsWritten).toBeLessThan(area / 4);
    expect(readMask(fog).data).toEqual(buildTerrainFogMask([...changedWest, ...east])!.data);
    fog.dispose();
  });

  it("writes nothing for an unchanged window and drops a removed page through its sub-rect", () => {
    const fog = new TerrainFogField();
    const west = block("west", 0, 5);
    const middle = block("middle", 8, 13);
    const east = block("east", 16, 21);
    fog.setPage("west", west);
    fog.setPage("middle", middle);
    fog.setPage("east", east);
    fog.commit();
    const uploads = vi.spyOn(DataTexture.prototype, "needsUpdate", "set");

    fog.commit();
    fog.setPage("east", [...east]);
    fog.commit();
    expect(fog.getMetrics()).toEqual({ fullRebuilds: 1, pageWrites: 0, texelsWritten: 0 });
    expect(uploads).toHaveBeenCalledTimes(2);

    fog.removePage("middle");
    fog.commit();
    expect(fog.getMetrics()).toMatchObject({ fullRebuilds: 1, pageWrites: 1 });
    expect(fog.getStats().instances).toBe(west.length + east.length);
    expect(readMask(fog).data).toEqual(buildTerrainFogMask([...west, ...east])!.data);
    fog.dispose();
  });

  it("finishes a reveal without rewriting the atmosphere mask", () => {
    const fog = new TerrainFogField();
    const cells = block("fixture", 0, 5);
    fog.setPage("fixture", cells);
    fog.commit();
    fog.queueReveal(2, 2);
    const revealed = withExploredCell(cells, 2, 2);
    fog.setPage("fixture", revealed);
    fog.commit();
    const pageWrite = fog.getMetrics().texelsWritten;

    for (let frame = 0; frame < 20; frame += 1) fog.updateAnimation(0.05);

    expect(fog.getMetrics()).toMatchObject({ fullRebuilds: 1, pageWrites: 1 });
    expect(fog.getMetrics().texelsWritten).toBe(pageWrite);
    expect(readMask(fog).data).toEqual(buildTerrainFogMask(revealed)!.data);
    fog.dispose();
  });

  it("only prepares a whole-window mask off-thread when the incoming pages move the fog window", () => {
    const fog = new TerrainFogField();
    const cells = block("fixture", 0, 5);
    expect(fog.requiresMaskRebuild(cells)).toBe(true);
    fog.setPage("fixture", cells);
    fog.commit();

    expect(fog.requiresMaskRebuild(withExploredCell(cells, 2, 2))).toBe(false);
    expect(fog.requiresMaskRebuild([...cells, instance(9, 0, false)])).toBe(true);
    expect(fog.requiresMaskRebuild([])).toBe(false);
    fog.dispose();
  });

  it("replaces and disposes the texture only when adaptive mask dimensions change", () => {
    const disposeTexture = vi.spyOn(DataTexture.prototype, "dispose");
    const fog = new TerrainFogField();
    fog.setPage("fixture", [instance(0, 0, false)]);
    fog.commit();
    disposeTexture.mockClear();

    const wideFog = [instance(0, 0, false), instance(80, 0, false)];
    fog.setPage("fixture", wideFog);
    fog.commit();
    const wideStats = fog.getStats();

    expect(wideStats.maskWidth).toBeGreaterThan(wideStats.maskHeight);
    expect(wideStats.maskBytes).toBe(wideStats.maskWidth * wideStats.maskHeight);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
    fog.setPage("fixture", wideFog);
    fog.commit();
    expect(disposeTexture).toHaveBeenCalledTimes(1);

    fog.dispose();
  });

  it("fails loudly before the bounded fog-cell contract can overflow", () => {
    const fog = new TerrainFogField();
    const instances = Array.from({ length: TERRAIN_FOG_CELL_CAPACITY + 1 }, (_, index) => instance(index, 0, false));

    expect(() => fog.setPage("fixture", instances)).toThrow(`exceeded ${TERRAIN_FOG_CELL_CAPACITY} cells`);
    fog.dispose();
  });
});

function instance(col: number, row: number, frontier: boolean, pageKey = "fixture"): TerrainShroudInstance {
  return {
    col,
    frontier,
    frontierDirection: frontier ? [1, 0] : [0, 0],
    pageKey,
    row,
    seed: 0.5,
    tint: [0.1, 0.2, 0.3],
    worldX: col * 1.732,
    worldY: 0.1,
    worldZ: row * 1.5,
  };
}

/** A square block of deep-fog cells from `minCol` to `maxCol` over rows 0..5. */
function block(pageKey: string, minCol: number, maxCol: number): TerrainShroudInstance[] {
  const cells: TerrainShroudInstance[] = [];
  for (let row = 0; row <= 5; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) cells.push(instance(col, row, false, pageKey));
  }
  return cells;
}

/** The block after `col,row` was explored: the cell leaves and its west neighbour becomes a frontier. */
function withExploredCell(cells: readonly TerrainShroudInstance[], col: number, row: number): TerrainShroudInstance[] {
  return cells
    .filter((cell) => cell.col !== col || cell.row !== row)
    .map((cell) =>
      cell.col === col - 1 && cell.row === row ? instance(cell.col, cell.row, true, cell.pageKey) : cell,
    );
}

function readMask(fog: TerrainFogField): TerrainFogMask {
  const mask = (fog as unknown as { mask: TerrainFogMask | null }).mask;
  if (!mask) throw new Error("Fog field has no mask");
  return mask;
}

function resolveWorldPositionAtUvY(mesh: Mesh, uvY: number): Vector3 {
  mesh.updateMatrixWorld(true);
  const positions = mesh.geometry.getAttribute("position") as BufferAttribute;
  const uvs = mesh.geometry.getAttribute("uv") as BufferAttribute;
  const vertexIndex = Array.from({ length: uvs.count }, (_, index) => index).find((index) => uvs.getY(index) === uvY);
  if (vertexIndex === undefined) throw new Error(`Fog sheet did not contain a vertex at UV y=${uvY}`);
  return new Vector3().fromBufferAttribute(positions, vertexIndex).applyMatrix4(mesh.matrixWorld);
}
