import { Group, InstancedMesh, Matrix4, PerspectiveCamera, Scene, Texture, TextureLoader, Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RainEffect } from "./rain-effect";

const rain = { rainIntensity: 1, windX: 1, windZ: 0 };
beforeEach(() => {
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation(() => new Texture());
});
afterEach(() => vi.restoreAllMocks());
function fixture() {
  const scene = new Scene();
  const effect = new RainEffect(scene, () => 2);
  const group = scene.children[0] as Group;
  const [curtains, splashes] = group.children as InstancedMesh[];
  return { scene, effect, group, curtains, splashes };
}
function positions(mesh: InstancedMesh): Vector3[] {
  return Array.from({ length: mesh.count }, (_, index) => {
    const matrix = new Matrix4();
    mesh.getMatrixAt(index, matrix);
    return new Vector3().setFromMatrixPosition(matrix);
  });
}
it("keeps drops anchored in the world while the camera pans and uses scene depth", () => {
  const { effect, curtains, splashes } = fixture();
  const target = new Vector3();
  effect.update(0, target, rain);
  const before = positions(curtains);
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 200);
  camera.position.set(0, 20, 30);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const projected = before[48].clone().project(camera);
  camera.position.x += 3;
  camera.updateMatrixWorld();
  effect.update(0.05, target.set(3, 0, 0), rain);
  expect(positions(curtains)).toEqual(before);
  expect(before[48].clone().project(camera).x).not.toBeCloseTo(projected.x);
  for (const mesh of [curtains, splashes]) {
    expect(mesh.material).toMatchObject({ depthTest: true, depthWrite: false });
  }
  expect(positions(splashes).every((position) => Math.abs(position.y - 2.04) < 0.001)).toBe(true);
  const splashMatrix = new Matrix4();
  splashes.getMatrixAt(0, splashMatrix);
  expect(new Vector3(0, 0, 1).transformDirection(splashMatrix).y).toBeCloseTo(1);
  effect.update(0.05, target.set(9, 0, 0), rain);
  const after = positions(curtains);
  expect(before.filter((point) => after.some((other) => point.equals(other)))).toHaveLength(84);
  effect.dispose();
});
it("animates only in rain, leaves splashes fixed, and disposes each resource once", () => {
  const { effect, scene, group, curtains } = fixture();
  const state = effect as any;
  const target = new Vector3();
  effect.update(0.05, target);
  expect(group.visible).toBe(false);
  expect(state.frameOffset.value.toArray()).toEqual([0, 0.75]);
  effect.update(0.05, target, rain);
  expect(group.visible).toBe(true);
  expect(state.frameOffset.value.toArray()).toEqual([0.25, 0.75]);
  expect(state.drift.value.x).toBeLessThan(0);
  effect.update(0.1, target, { ...rain, rainIntensity: 0 });
  expect(group.visible).toBe(false);
  const materialDispose = vi.spyOn(curtains.material as any, "dispose");
  const textureDispose = vi.spyOn(state.dropsSheet, "dispose");
  const geometryDispose = vi.spyOn(curtains.geometry, "dispose");
  effect.dispose();
  effect.dispose();
  expect(scene.children).toHaveLength(0);
  for (const dispose of [materialDispose, textureDispose, geometryDispose]) expect(dispose).toHaveBeenCalledTimes(1);
});
