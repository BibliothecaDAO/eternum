import { Scene, Group, Vector3 } from "three";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProceduralArmyCharacterLayer } from "./procedural-army-character-layer";
import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "./procedural-unit-config";
import type { ProceduralUnitConfig } from "./procedural-unit-config";

const { runtime, createRuntime } = vi.hoisted(() => ({
  createRuntime: vi.fn(),
  runtime: {
    createActor: vi.fn(),
    updateActorConfig: vi.fn(),
    updatePhysicsConfig: vi.fn(),
    areAssetsReady: vi.fn(),
    prepareAssets: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  },
}));
vi.mock("@/three/characters", () => ({
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
  ProceduralUnitRuntime: {
    create: async () => {
      await createRuntime();
      return runtime;
    },
  },
}));
afterEach(() => vi.clearAllMocks());

describe("production Knight presentation", () => {
  it("does not prepare a family when its unit leaves before runtime startup completes", async () => {
    let finish!: () => void;
    createRuntime.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    try {
      layer.sync([], 0);
      expect(createRuntime).not.toHaveBeenCalled();
      layer.sync(
        [
          {
            entityId: 42,
            category: TroopType.Knight,
            tier: TroopTier.T1,
            isNaval: false,
            isMoving: false,
            primaryColor: "#ffffff",
            position: new Vector3(),
            distanceToCameraSquared: 400,
          },
        ],
        0,
      );
      await vi.waitFor(() => expect(createRuntime).toHaveBeenCalledOnce());
      layer.sync([], 0);
      finish();
      await vi.waitFor(() => expect(layer.getStats().loadState).toBe("ready"));
      expect(runtime.prepareAssets).not.toHaveBeenCalled();
      expect(runtime.createActor).not.toHaveBeenCalled();
    } finally {
      layer.dispose();
    }
  });

  it("prepares only the visible LOD, reaches reconciliation after leaving during load, and switches at close range", async () => {
    const loaded = new Set<string>();
    let finish!: () => void;
    runtime.areAssetsReady.mockImplementation((config: ProceduralUnitConfig) =>
      loaded.has(config.humanoid.renderDetail),
    );
    runtime.prepareAssets.mockImplementation(
      (config: ProceduralUnitConfig) =>
        new Promise<void>((resolve) => {
          finish = () => {
            loaded.add(config.humanoid.renderDetail);
            resolve();
          };
        }),
    );
    const object = new Group();
    const actor = {
      object,
      kind: "knight",
      mode: "animated",
      onRangedRelease: () => () => {},
      onMeleeContact: () => () => {},
      dispose: () => object.removeFromParent(),
    };
    runtime.createActor.mockReturnValue(actor);
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const army = {
      entityId: 42,
      category: TroopType.Knight,
      tier: TroopTier.T1,
      isNaval: false,
      isMoving: false,
      primaryColor: "#ffffff",
      position: new Vector3(),
      distanceToCameraSquared: 400,
    };
    try {
      layer.sync([army], 0);
      await vi.waitFor(() => expect(runtime.prepareAssets).toHaveBeenCalledTimes(1));
      expect(runtime.prepareAssets.mock.calls[0][0]).toMatchObject({
        humanoid: { appearanceId: "t1-knight-default", renderDetail: "crowd" },
        melee: { detailedEquipment: true, weaponId: "t1-knight-default-sword", offhandId: "t1-knight-default-shield" },
      });
      layer.sync([], 0);
      finish();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(layer.hasActor(42)).toBe(false);
      layer.sync([army], 0);
      expect(layer.hasActor(42)).toBe(true);
      expect(object.scale.toArray()).toEqual([1.67, 1.67, 1.67]);
      expect(runtime.createActor).toHaveBeenCalledWith(
        expect.objectContaining({ humanoid: expect.objectContaining({ renderDetail: "crowd" }) }),
      );
      layer.sync([{ ...army, distanceToCameraSquared: 100 }], 0);
      expect(runtime.prepareAssets).toHaveBeenCalledTimes(2);
      expect(runtime.prepareAssets.mock.calls[1][0].humanoid.renderDetail).toBe("hero");
      expect(runtime.updateActorConfig).not.toHaveBeenCalled();
      finish();
      await new Promise((resolve) => setTimeout(resolve, 0));
      layer.sync([{ ...army, distanceToCameraSquared: 100 }], 0);
      expect(runtime.updateActorConfig).toHaveBeenCalledWith(
        actor,
        expect.objectContaining({ humanoid: expect.objectContaining({ renderDetail: "hero" }) }),
      );
      layer.sync([army], 0);
      expect(runtime.updateActorConfig).toHaveBeenLastCalledWith(
        actor,
        expect.objectContaining({ humanoid: expect.objectContaining({ renderDetail: "crowd" }) }),
      );
      expect(runtime.prepareAssets).toHaveBeenCalledTimes(2);
    } finally {
      layer.dispose();
    }
  });
});
