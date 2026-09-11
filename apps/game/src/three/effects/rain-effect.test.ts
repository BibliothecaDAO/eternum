vi.mock("../utils/utils", () => ({ loadKtx2Texture: vi.fn(() => Promise.resolve(new Texture())) }));
import { Group, InstancedMesh, Matrix4, PerspectiveCamera, Scene, Texture, Vector3 } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { RainEffect } from "./rain-effect";

const rain = { rainIntensity: 1, windX: 1, windZ: 0 };
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
  const projected = before[24].clone().project(camera);
  camera.position.x += 3;
  camera.updateMatrixWorld();
  effect.update(0.05, target.set(3, 0, 0), rain);
  expect(positions(curtains)).toEqual(before);
  expect(before[24].clone().project(camera).x).not.toBeCloseTo(projected.x);
  for (const mesh of [curtains, splashes]) {
    expect(mesh.material).toMatchObject({ depthTest: true, depthWrite: false, forceSinglePass: true });
  }
  expect(positions(splashes).every((position) => Math.abs(position.y - 2.04) < 0.001)).toBe(true);
  const splashMatrix = new Matrix4();
  splashes.getMatrixAt(0, splashMatrix);
  expect(new Vector3(0, 0, 1).transformDirection(splashMatrix).y).toBeCloseTo(1);
  effect.update(0.05, target.set(9, 0, 0), rain);
  const after = positions(curtains);
  expect(before.filter((point) => after.some((other) => point.equals(other)))).toHaveLength(42);
  effect.dispose();
});
it("animates only in rain, leaves splashes fixed, and disposes its own resources once while sharing the sheets", () => {
  const { effect, scene, group, curtains } = fixture();
  const state = effect as any;
  const target = new Vector3();
  effect.update(0.05, target);
  expect(group.visible).toBe(false);
  expect(state.frameOffset.value.toArray()).toEqual([0, 0.75]);
  effect.update(0.05, target, rain);
  expect(group.visible).toBe(true);
  expect(state.frameOffset.value.toArray()).toEqual([0.25, 0.75]);
  expect(state.fallOffset.value).toBeCloseTo(0.1);
  effect.update(0.1, target, { ...rain, rainIntensity: 0 });
  expect(group.visible).toBe(false);
  const materialDispose = vi.spyOn(curtains.material as any, "dispose");
  const textureDispose = vi.spyOn(state.splashesSheet.value, "dispose");
  const geometryDispose = vi.spyOn(curtains.geometry, "dispose");
  effect.dispose();
  effect.dispose();
  expect(scene.children).toHaveLength(0);
  for (const dispose of [materialDispose, geometryDispose]) expect(dispose).toHaveBeenCalledTimes(1);
  expect(textureDispose).not.toHaveBeenCalled();
});

it("keeps streaks and their falling motion screen-vertical through camera orbits and wind changes", () => {
  const { effect, curtains, splashes } = fixture();
  const target = new Vector3();
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 200);
  effect.update(0, target, rain);
  const anchors = positions(curtains);
  const splashAnchors = positions(splashes);
  for (const position of [new Vector3(0, 20, 30), new Vector3(30, 20, 0), new Vector3(-20, 35, -20)]) {
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    curtains.onBeforeRender(null as any, null as any, camera, null as any, null as any, null as any);
    for (let index = 0; index < curtains.count; index++) {
      const matrix = new Matrix4();
      curtains.getMatrixAt(index, matrix);
      const top = new Vector3(0, 0.2, 0).applyMatrix4(matrix).project(camera);
      const bottom = new Vector3(0, -0.2, 0).applyMatrix4(matrix).project(camera);
      expect(top.x).toBeCloseTo(bottom.x, 5);
      expect(top.y).toBeGreaterThan(bottom.y);
    }
    expect(positions(curtains)).toEqual(anchors);
    expect(positions(splashes)).toEqual(splashAnchors);
  }
  const state = effect as any;
  const beforeFall = state.fallOffset.value;
  const windy = { rainIntensity: 1, windX: -10, windZ: 10 };
  effect.update(0.1, target, windy);
  expect(state.fallOffset.value).toBeCloseTo(beforeFall + 0.2);
  expect(positions(curtains)).toEqual(anchors);
  effect.dispose();
});
