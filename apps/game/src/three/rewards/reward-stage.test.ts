import { type Mesh, type MeshBasicMaterial, PerspectiveCamera, Vector3 } from "three";
import { afterEach, describe, expect, it } from "vitest";

import { HUD_COLORS } from "@/tokens";
import { createChestPool } from "./chest-pool-fixture";
import type { ChestTransitions } from "./chest-transitions";
import { CHEST_VEIL_SECONDS, RewardStage } from "./reward-stage";

const BEATS = { onShown: () => {}, onOpen: () => {}, onEnd: () => {} };

let pool: ChestTransitions;
let clock = 0;

afterEach(() => pool.dispose());

/** The map's camera as the world map holds it: looking down at the board from `height`, at `aspect`. */
const mapCamera = (height: number, aspect = 16 / 9) => {
  const camera = new PerspectiveCamera(30, aspect, 0.1, 500);
  camera.position.set(4, height, height * 0.8);
  camera.lookAt(4, 0, 0);
  camera.updateMatrixWorld();
  return camera;
};

/** A stage over a real chest pool, its model ready at once. */
const stageWithChest = async (view = mapCamera(12)) => {
  pool = createChestPool();
  clock = 0;
  const stage = new RewardStage(async () => ({ transitions: pool, time: clock }));
  await stage.present(BEATS);
  const frame = (seconds: number, camera = view) => {
    clock += seconds;
    stage.update(seconds, clock, camera);
  };
  frame(0);
  return { stage, frame };
};

const passNamed = (stage: RewardStage, name: string) => stage.passes().find((pass) => pass.name === name);

/** Where a point of the stage lands on screen, in -1..1 from the screen's centre. */
const onScreen = (stage: RewardStage, point: Vector3) =>
  point.clone().project(passNamed(stage, "reward-stage")!.camera);

// Owner, 28 October 2026: "its not really over the map nor the models ? it should be above the models as well".
describe("a reward's chest, staged over everything", () => {
  it("draws nothing while no chest is staged", () => {
    pool = createChestPool();
    const stage = new RewardStage(async () => ({ transitions: pool, time: 0 }));
    stage.update(0.1, 0.1, mapCamera(12));
    expect(stage.passes()).toEqual([]);
  });

  it("draws the chest in its own pass, with its own camera and light, standing at the stage's origin", async () => {
    const view = mapCamera(12);
    const { stage } = await stageWithChest(view);
    const pass = passNamed(stage, "reward-stage")!;
    expect(pass.scene).toBe(stage.scene);
    expect(pass.camera).not.toBe(view);
    expect(pool.group.parent).toBe(stage.scene);
    const chest = pool.group.children.find((root) => root.visible)!;
    chest.updateWorldMatrix(true, false);
    expect(new Vector3().setFromMatrixPosition(chest.matrixWorld).length()).toBe(0);
    expect(stage.scene.children.some((child) => (child as { isLight?: boolean }).isLight)).toBe(true);
  });

  it("centres the chest on the screen at B's size, a fifth of its height, whatever the map's zoom", async () => {
    const { stage, frame } = await stageWithChest(mapCamera(8));
    const up = new Vector3(0, 1, 0).applyQuaternion(stage.camera.quaternion);
    const near = { centre: onScreen(stage, new Vector3()), top: onScreen(stage, up) };
    frame(0.1, mapCamera(40));
    const far = { centre: onScreen(stage, new Vector3()), top: onScreen(stage, up) };

    expect(near.centre.x).toBeCloseTo(0, 6);
    expect(near.centre.y).toBeCloseTo(0, 6);
    // One unit, the chest's hex from its centre to a corner, spans 22% of the screen's height (2 in screen units).
    expect(near.top.y).toBeCloseTo(0.44, 6);
    expect(far.top.y).toBeCloseTo(near.top.y, 6);
  });

  it("veils the whole board in the HUD's ink, in a pass before the chest's", async () => {
    const { stage, frame } = await stageWithChest();
    frame(CHEST_VEIL_SECONDS);
    expect(stage.passes().map((pass) => pass.name)).toEqual(["reward-stage-veil", "reward-stage"]);
    const { scene, camera } = passNamed(stage, "reward-stage-veil")!;
    const veil = scene.children[0] as Mesh<never, MeshBasicMaterial>;
    veil.updateWorldMatrix(true, false);
    const corners = [
      [-1, -1],
      [1, 1],
    ].map(([x, y]) => veil.localToWorld(new Vector3(x, y, 0)).project(camera));
    expect(corners[0].x).toBeLessThanOrEqual(-1);
    expect(corners[0].y).toBeLessThanOrEqual(-1);
    expect(corners[1].x).toBeGreaterThanOrEqual(1);
    expect(corners[1].y).toBeGreaterThanOrEqual(1);
    expect(`#${veil.material.color.getHexString()}`).toBe(HUD_COLORS.ink);
    expect(veil.material.opacity).toBeGreaterThan(0.7);
  });

  it("lifts the veil after the chest goes, then draws nothing", async () => {
    const { stage, frame } = await stageWithChest();
    for (let second = 0; second < 6; second += 0.1) frame(0.1);
    expect(pool.has("centre")).toBe(false);
    expect(stage.passes()).toEqual([]);
  });

  it("drops the chest and its veil at once when the map is left", async () => {
    const { stage, frame } = await stageWithChest();
    frame(0.5);
    stage.end();
    expect(pool.has("centre")).toBe(false);
    expect(stage.passes()).toEqual([]);
  });
});
