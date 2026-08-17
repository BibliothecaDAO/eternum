import { BoxGeometry, Mesh, MeshStandardMaterial, Scene, Texture } from "three";
import { describe, expect, it, vi } from "vitest";
import type { FrameBudgetWorkLane, FrameBudgetWorkScheduler } from "./frame-budget-work-queue";
import { prepareSceneTextures } from "./scene-texture-preparation";

function createImmediateScheduler(lanes: FrameBudgetWorkLane[]): FrameBudgetWorkScheduler {
  return {
    schedule: async (lane, work) => {
      lanes.push(lane);
      return work();
    },
  };
}

describe("prepareSceneTextures", () => {
  it("initializes each scene texture once through the visible frame-budget lane", async () => {
    const scene = new Scene();
    const sharedTexture = new Texture();
    const normalTexture = new Texture();
    const firstMaterial = new MeshStandardMaterial({ map: sharedTexture, normalMap: normalTexture });
    const secondMaterial = new MeshStandardMaterial({ map: sharedTexture });
    scene.add(new Mesh(new BoxGeometry(), firstMaterial), new Mesh(new BoxGeometry(), secondMaterial));
    const initialized: Texture[] = [];
    const lanes: FrameBudgetWorkLane[] = [];
    const preparedTextures = new WeakSet<Texture>();
    const input = {
      initializeTexture: (texture: Texture) => initialized.push(texture),
      owner: "scene:test:texture-upload",
      preparedTextures,
      scene,
      scheduler: createImmediateScheduler(lanes),
    };

    await expect(prepareSceneTextures(input)).resolves.toBe(2);
    await expect(prepareSceneTextures(input)).resolves.toBe(0);

    expect(initialized).toEqual(expect.arrayContaining([sharedTexture, normalTexture]));
    expect(initialized).toHaveLength(2);
    expect(lanes).toEqual(["visible", "visible"]);
  });

  it("warns and leaves a failed upload eligible for the renderer fallback", async () => {
    const scene = new Scene();
    const texture = new Texture();
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: texture })));
    const warn = vi.fn();
    const preparedTextures = new WeakSet<Texture>();

    await prepareSceneTextures({
      initializeTexture: () => {
        throw new Error("upload failed");
      },
      owner: "scene:test:texture-upload",
      preparedTextures,
      scene,
      scheduler: createImmediateScheduler([]),
      warn,
    });

    expect(preparedTextures.has(texture)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });
});
