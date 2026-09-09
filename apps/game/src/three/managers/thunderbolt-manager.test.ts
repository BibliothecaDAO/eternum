import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Texture, TextureLoader, Vector3 } from "three";
vi.mock("../constants", () => ({ HEX_SIZE: 1 }));
vi.mock("../utils", () => ({
  getWorldPositionForHex: ({ col, row }: { col: number; row: number }) => new Vector3(col, 0, row),
}));
import { ThunderBoltManager } from "./thunderbolt-manager";
beforeEach(() => {
  vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
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
  expect(front.material.depthTest).toBe(true);
  now += 250;
  manager.update();
  expect(front.material.map!.offset.toArray()).toEqual([0.625, 0.875]);
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
  manager.destroy();
  manager.destroy();
  manager.spawnThunderBoltAt({ col: 1, row: 1 });
  expect(dispose).toHaveBeenCalledTimes(1);
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
  const strikes = scene.children[0].children;
  const rows = strikes.map((strike) => (strike.children[0] as Mesh<any, MeshBasicMaterial>).material.map!.offset.y);
  expect(new Set(rows).size).toBe(4);
  for (const strike of strikes) {
    const [bolt, flash] = strike.children as Mesh<any, MeshBasicMaterial>[];
    expect(bolt.material.map!.repeat.toArray()).toEqual([0.125, 0.125]);
    expect(flash.material.map!.repeat.toArray()).toEqual([0.25, 0.25]);
    expect(flash.material.map!.offset.toArray()).toEqual([0.5, 0.75]);
  }
  manager.destroy();
});
