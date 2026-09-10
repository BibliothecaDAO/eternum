vi.mock("../utils/utils", () => ({ loadKtx2Texture: vi.fn(() => Promise.resolve(new Texture())) }));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Texture, Vector3 } from "three";
vi.mock("../constants", () => ({ HEX_SIZE: 1 }));
vi.mock("../utils", () => ({
  getWorldPositionForHex: ({ col, row }: { col: number; row: number }) => new Vector3(col, 0, row),
}));
import { ThunderBoltManager } from "./thunderbolt-manager";
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => vi.restoreAllMocks());
it("anchors the strike at its hex, advances frames, and removes it after the sheet finishes", () => {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const scene = new Scene();
  const manager = new ThunderBoltManager(scene, { target: new Vector3() }, () => 2);
  manager.spawnThunderBoltAt({ col: 3, row: 4 });
  const strike = scene.children[0].children[0] as Group;
  expect(strike.position.toArray()).toEqual([3, 2.05, 4]);
  const [front, flash] = strike.children as Mesh<import("three").BufferGeometry, MeshBasicMaterial>[];
  const normal = flash.geometry.attributes.normal;
  expect(new Vector3().fromBufferAttribute(normal, 0).y).toBeCloseTo(1);
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 100);
  camera.position.set(3, 20, 25);
  camera.lookAt(strike.position);
  camera.updateMatrixWorld();
  const tip = strike.position.clone().add(new Vector3(0, 12, 0));
  const firstView = tip.clone().project(camera);
  camera.position.set(20, 35, 25);
  camera.lookAt(strike.position);
  camera.updateMatrixWorld();
  expect(tip.clone().project(camera).y).not.toBeCloseTo(firstView.y);
  expect(front.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
  expect(front.material).toMatchObject({ depthTest: true, forceSinglePass: true });
  now += 250;
  manager.update();
  expect(manager["activeThunderBolts"][0].frameOffsets[0].toArray()).toEqual([0.625, 0.875]);
  now += 550;
  manager.update();
  expect(manager.getActiveCount()).toBe(0);
  expect(scene.children[0].children).toHaveLength(0);
  manager.destroy();
});
it("releases resources and cannot spawn after destruction", () => {
  const scene = new Scene();
  const manager = new ThunderBoltManager(scene, { target: new Vector3() });
  manager.spawnThunderBoltAt({ col: 0, row: 0 });
  const front = scene.children[0].children[0].children[0] as Mesh;
  const dispose = vi.spyOn(front.material as MeshBasicMaterial, "dispose");
  const sheetDispose = vi.spyOn(manager["boltSheet"].value, "dispose");
  manager.destroy();
  manager.destroy();
  manager.spawnThunderBoltAt({ col: 1, row: 1 });
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(sheetDispose).not.toHaveBeenCalled();
  expect(manager.getActiveCount()).toBe(0);
  expect(scene.children).toHaveLength(0);
});
it("keeps the authored bolt tip on the ground-flash centre at different camera bearings", () => {
  const camera = { position: new Vector3(12, 30, 20) };
  const scene = new Scene();
  const manager = new ThunderBoltManager(scene, { target: new Vector3(), object: camera }, () => 3);
  for (const bearing of [0, Math.PI / 3, Math.PI]) {
    camera.position.set(Math.sin(bearing) * 30, 30, Math.cos(bearing) * 30);
    manager.spawnThunderBoltAt({ col: 0, row: 0 });
    const strike = scene.children[0].children.at(-1)!;
    scene.updateMatrixWorld(true);
    const [bolt, flash] = strike.children as Mesh[];
    // Plane UV (0.5, 0.14) is the authored core's terminal point.
    const positions = bolt.geometry.attributes.position;
    const top = new Vector3()
      .fromBufferAttribute(positions, 0)
      .lerp(new Vector3().fromBufferAttribute(positions, 1), 0.5);
    const bottom = new Vector3()
      .fromBufferAttribute(positions, 2)
      .lerp(new Vector3().fromBufferAttribute(positions, 3), 0.5);
    const tip = bottom.lerp(top, 0.14).applyMatrix4(bolt.matrixWorld);
    const centre = flash.getWorldPosition(new Vector3());
    expect(tip.distanceTo(centre)).toBeLessThan(0.00001);
    expect(strike.children).toHaveLength(2);
  }
  manager.destroy();
});
it("varies adjacent strikes while keeping each variant synchronized to the ground flash", () => {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const scene = new Scene();
  const manager = new ThunderBoltManager(scene, { target: new Vector3() });
  for (const [i, random] of [0, 0, 0.5, 0.99].entries()) {
    vi.mocked(Math.random).mockReturnValue(random);
    manager.spawnThunderBoltAt({ col: i, row: 0 });
  }
  now += 100;
  manager.update();
  const rows = manager["activeThunderBolts"].map((strike) => strike.frameOffsets[0].y);
  expect(new Set(rows).size).toBe(4);
  for (const strike of manager["activeThunderBolts"]) {
    expect(strike.frameOffsets[1].toArray()).toEqual([0.5, 0.75]);
  }
  const maps = manager["activeThunderBolts"].flatMap((strike) =>
    strike.materials.map((material) => (material.colorNode as any).node.value),
  );
  expect(new Set(maps.filter((_, index) => index % 2 === 0)).size).toBe(1);
  expect(new Set(maps.filter((_, index) => index % 2 === 1)).size).toBe(1);
  for (const map of maps) expect(map!.offset.toArray()).toEqual([0, 0]);
  manager.destroy();
});
it("reuses expired strike resources and resets their animation and placement", () => {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const scene = new Scene();
  const camera = { position: new Vector3(0, 20, 20) };
  const manager = new ThunderBoltManager(scene, { target: new Vector3(), object: camera }, () => 3);
  manager.spawnThunderBoltAt({ col: 0, row: 0 });
  const first = manager["activeThunderBolts"][0];
  const disposals = first.materials.map((material) => vi.spyOn(material, "dispose"));
  now += 500;
  manager.update();
  now += 300;
  manager.update();
  expect(manager.getActiveCount()).toBe(0);
  for (const dispose of disposals) expect(dispose).not.toHaveBeenCalled();
  camera.position.set(20, 20, 0);
  manager.spawnThunderBoltAt({ col: 3, row: 4 });
  const reused = manager["activeThunderBolts"][0];
  expect(reused).toBe(first);
  expect(reused.startTime).toBe(now);
  expect(reused.group.position.toArray()).toEqual([3, 3.05, 4]);
  expect(reused.group.children[0].rotation.y).toBeCloseTo(Math.atan2(17, -4));
  expect(reused.frameOffsets.map((offset) => offset.toArray())).toEqual([
    [0, 0.625],
    [0, 0.75],
  ]);
  manager.cleanup();
  expect(scene.children[0].children).toHaveLength(0);
  manager.destroy();
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
});
it("bounds retained strike resources and destroys both idle and overflow materials once", () => {
  const manager = new ThunderBoltManager(new Scene(), { target: new Vector3() });
  for (let index = 0; index < 25; index++) manager.spawnThunderBoltAt({ col: index, row: 0 });
  const disposals = manager["activeThunderBolts"].flatMap((strike) =>
    strike.materials.map((material) => vi.spyOn(material, "dispose")),
  );
  manager.cleanup();
  expect(manager["idleThunderBolts"]).toHaveLength(20);
  expect(disposals.filter((dispose) => dispose.mock.calls.length > 0)).toHaveLength(10);
  manager.destroy();
  manager.destroy();
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
});
