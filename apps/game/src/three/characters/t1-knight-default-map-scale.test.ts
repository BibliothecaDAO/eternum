// @vitest-environment node
import { Group, Scene, Vector3, type Bone } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTextureFreeGlb } from "../../../test-support/parse-texture-free-glb";
import type { ProceduralCharacterRenderDetail } from "./procedural-character-config";
import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "./procedural-unit-config";
import { ProceduralUnitRuntime } from "./procedural-unit-runtime";

vi.mock("./horse/procedural-horse-runtime", () => ({
  ProceduralHorseRuntime: { create: vi.fn(async () => ({ dispose: vi.fn() })) },
}));
vi.mock("./dragon/procedural-dragon-runtime", () => ({
  ProceduralDragonRuntime: { create: vi.fn(async () => ({ dispose: vi.fn() })) },
}));
vi.mock("./boat/procedural-boat-runtime", () => ({
  ProceduralBoatRuntime: { create: vi.fn(async () => ({ dispose: vi.fn() })) },
}));
vi.mock("./jolt-ragdoll-world", () => ({
  JoltRagdollWorld: { create: vi.fn(async () => ({ dispose: vi.fn(), update: vi.fn() })) },
}));

/** How large the army layer draws the T1 Knight on the map (T1_KNIGHT_WORLD_SCALE). */
const MAP_SCALE = 1.67;
/** The ground under the army's tile. */
const GROUND = 0.084;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const knight = (renderDetail: ProceduralCharacterRenderDetail) =>
  applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
    kind: "knight",
    humanoid: { tier: 1, renderDetail, animationMode: "idle" },
  });

/** The lower ankle's height above the ground, in the Knight's own size (it stands 0.61 tall). */
function ankleAboveGround(object: Group): number {
  object.updateMatrixWorld(true);
  let lowest = Infinity;
  object.traverse((child) => {
    if ((child as Bone).isBone && /^foot_[lr]$/.test(child.name)) {
      lowest = Math.min(lowest, child.getWorldPosition(new Vector3()).y);
    }
  });
  return (lowest - GROUND) / MAP_SCALE;
}

describe("T1 Knight on the map", () => {
  it("stands on its tile's ground at map scale, before and after its skin changes detail", async () => {
    vi.stubGlobal("ProgressEvent", class extends Event {});
    const cache = new Map<string, Promise<GLTF>>();
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation((url) => {
      const key = String(url);
      if (!cache.has(key)) cache.set(key, parseTextureFreeGlb(key));
      return cache.get(key) as Promise<GLTF>;
    });
    const runtime = await ProceduralUnitRuntime.create();
    const scene = new Scene();
    try {
      await runtime.prepareAssets(knight("hero"));
      await runtime.prepareAssets(knight("crowd"));
      // The army layer's order: create the actor, then place and scale it on the army's tile.
      const actor = runtime.createActor(knight("hero"));
      scene.add(actor.object);
      actor.object.position.set(-9.5, GROUND, 7.5);
      actor.object.scale.setScalar(MAP_SCALE);
      const idle = () => {
        for (let frame = 0; frame < 30; frame++) runtime.update(1 / 60);
        return ankleAboveGround(actor.object as Group);
      };

      const heights = [idle()];
      // Zooming in and out swaps the near and mid skins.
      runtime.updateActorConfig(actor, knight("crowd"));
      heights.push(idle());
      runtime.updateActorConfig(actor, knight("hero"));
      heights.push(idle());

      expect(
        heights.map((height) => height < 0.05),
        `ankles ${heights.map((height) => height.toFixed(3))}`,
      ).toEqual([true, true, true]);
      actor.dispose();
    } finally {
      runtime.dispose();
    }
  });
});
