import { Scene, Group, Vector3 } from "three";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

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

describe("the Knight's close-up switch", () => {
  it("takes its near rig inside 11 units and keeps it out to 13, so a small zoom in the closest band rebuilds nothing", async () => {
    const proof = recoveryFixture();
    proof.loaded.add("crowd");
    proof.loaded.add("hero");
    const at = (distance: number) => ({ ...proof.mid, distanceToCameraSquared: distance * distance });
    const detail = () => runtime.updateActorConfig.mock.lastCall?.[1].humanoid.renderDetail;
    try {
      proof.layer.sync([at(20)], 0);
      await vi.waitFor(() => expect(proof.layer.hasActor(42)).toBe(true));
      expect(runtime.createActor.mock.lastCall?.[0].humanoid.renderDetail).toBe("crowd");

      proof.layer.sync([at(11.5)], 0);
      expect(runtime.updateActorConfig).not.toHaveBeenCalled();
      proof.layer.sync([at(10.5)], 0);
      expect(detail()).toBe("hero");

      // Zooming out a little, still inside the closest band, keeps the near rig.
      proof.layer.sync([at(12.5)], 0);
      proof.layer.sync([at(11.5)], 0);
      proof.layer.sync([at(12.9)], 0);
      expect(runtime.updateActorConfig).toHaveBeenCalledTimes(1);

      proof.layer.sync([at(13.5)], 0);
      expect(detail()).toBe("crowd");
      proof.layer.sync([at(12.5)], 0);
      expect(runtime.updateActorConfig).toHaveBeenCalledTimes(2);
    } finally {
      proof.layer.dispose();
    }
  });
});

describe("the Knights' creation budget", () => {
  it("is spent only on actors made, so armies whose skin failed never hold back a Knight behind them", async () => {
    const proof = recoveryFixture();
    runtime.areAssetsReady.mockImplementation((config: ProceduralUnitConfig) => config.kind === "knight");
    runtime.prepareAssets.mockRejectedValue(new Error("archer skin unavailable"));
    const archers = [1, 2, 3, 4].map((entityId) => ({
      ...proof.mid,
      entityId,
      category: TroopType.Crossbowman,
      position: new Vector3(entityId * 3, 0, 0),
    }));
    try {
      proof.layer.sync([...archers, proof.mid], 0);
      await vi.waitFor(() => expect(runtime.prepareAssets).toHaveBeenCalled());
      await flushLoads();
      proof.layer.sync([...archers, proof.mid], 0);
      expect(proof.layer.hasActor(42)).toBe(true);
      expect(archers.some(({ entityId }) => proof.layer.hasActor(entityId))).toBe(false);
    } finally {
      proof.layer.dispose();
    }
  });
});

describe("visible asset request recovery", () => {
  it("retries a rejected skin on leave/return, not on frames, motion, colour or another unit sharing the need", async () => {
    const proof = recoveryFixture();
    try {
      proof.layer.sync([proof.mid], 0);
      await vi.waitFor(() => expect(proof.requests).toHaveLength(1));
      proof.requests[0].reject(new Error("temporary network failure"));
      await flushLoads();
      expect(proof.layer.getStats().loadState).toBe("failed");
      for (let frame = 0; frame < 30; frame++) {
        proof.layer.sync(
          [
            { ...proof.mid, isMoving: frame % 2 === 0, primaryColor: "#ff0000" },
            { ...proof.mid, entityId: 43 },
          ],
          0,
        );
      }
      expect(runtime.prepareAssets).toHaveBeenCalledTimes(1);
      proof.layer.sync([], 0);
      proof.layer.sync([proof.mid], 0);
      expect(proof.requests).toHaveLength(2);
      proof.requests[1].resolve();
      await flushLoads();
      proof.layer.sync([proof.mid], 0);
      expect(proof.layer.hasActor(42)).toBe(true);
      expect(proof.scene.getObjectByName("procedural-army-character:42")).toBeDefined();
      expect(runtime.createActor).toHaveBeenCalledWith(
        expect.objectContaining({ humanoid: expect.objectContaining({ renderDetail: "crowd" }) }),
      );
      expect(proof.layer.getStats().loadState).toBe("ready");
    } finally {
      proof.layer.dispose();
    }
  });

  it("keeps loaded actors operational through a failed near request and completes the next LOD need", async () => {
    const proof = recoveryFixture();
    proof.loaded.add("crowd");
    try {
      proof.layer.sync([proof.mid], 0);
      await vi.waitFor(() => expect(proof.layer.hasActor(42)).toBe(true));
      const actor = runtime.createActor.mock.results[0].value;
      proof.layer.sync([proof.near], 0);
      proof.requests[0].reject(new Error("near request failed"));
      await flushLoads();
      for (let frame = 0; frame < 30; frame++) proof.layer.sync([proof.near], 1 / 60);
      expect(proof.requests).toHaveLength(1);
      await proof.layer.applyImpulse(42);
      await proof.layer.startRagdoll(42);
      expect(actor.applyImpulse).toHaveBeenCalledOnce();
      expect(actor.startRagdoll).toHaveBeenCalledOnce();
      expect(proof.layer.playAttack(42, new Vector3(2, 0, 2))).toBe(true);
      expect(runtime.update).toHaveBeenLastCalledWith(1 / 60);
      proof.layer.sync([proof.near, { ...proof.mid, entityId: 43 }], 0);
      expect(proof.layer.hasActor(43)).toBe(true);
      expect(runtime.updateActorConfig).not.toHaveBeenCalled();
      proof.layer.sync([proof.mid], 0);
      proof.layer.sync([proof.near], 0);
      expect(proof.requests).toHaveLength(2);
      proof.requests[1].resolve();
      await flushLoads();
      proof.layer.sync([proof.near], 0);
      expect(runtime.updateActorConfig).toHaveBeenCalledWith(
        actor,
        expect.objectContaining({ humanoid: expect.objectContaining({ renderDetail: "hero" }) }),
      );
      expect(proof.layer.getStats()).toMatchObject({ loadState: "ready", nearKnightCount: 1, midKnightCount: 0 });
    } finally {
      proof.layer.dispose();
    }
  });

  it("loads another missing detail while the failed detail remains visible", async () => {
    const proof = recoveryFixture();
    const other = { ...proof.near, entityId: 43, position: new Vector3(4, 0, 0) };
    try {
      proof.layer.sync([proof.mid], 0);
      await vi.waitFor(() => expect(proof.requests).toHaveLength(1));
      proof.requests[0].reject(new Error("mid unavailable"));
      await flushLoads();
      proof.layer.sync([proof.mid, other], 0);
      expect(proof.requests).toHaveLength(2);
      expect(runtime.prepareAssets.mock.calls[1][0].humanoid.renderDetail).toBe("hero");
      proof.requests[1].resolve();
      await flushLoads();
      proof.layer.sync([proof.mid, other], 0);
      expect(proof.layer.hasActor(42)).toBe(false);
      expect(proof.layer.hasActor(43)).toBe(true);
      expect(proof.requests).toHaveLength(2);
    } finally {
      proof.layer.dispose();
    }
  });

  it("does not let an old rejection poison a need that left and returned during its request", async () => {
    const proof = recoveryFixture();
    try {
      proof.layer.sync([proof.mid], 0);
      await vi.waitFor(() => expect(proof.requests).toHaveLength(1));
      proof.layer.sync([], 0);
      proof.layer.sync([proof.mid], 0);
      proof.requests[0].reject(new Error("old request"));
      await flushLoads();
      proof.layer.sync([proof.mid], 0);
      expect(proof.requests).toHaveLength(2);
      proof.requests[1].resolve();
      await flushLoads();
      proof.layer.sync([proof.mid], 0);
      expect(proof.layer.hasActor(42)).toBe(true);
    } finally {
      proof.layer.dispose();
    }
  });

  it.each(["resolve", "reject"] as const)("ignores retry completion after disposal (%s)", async (completion) => {
    const proof = recoveryFixture();
    proof.layer.sync([proof.mid], 0);
    await vi.waitFor(() => expect(proof.requests).toHaveLength(1));
    proof.requests[0].reject(new Error("first request"));
    await flushLoads();
    proof.layer.sync([], 0);
    proof.layer.sync([proof.mid], 0);
    expect(proof.requests).toHaveLength(2);
    proof.layer.dispose();
    if (completion === "resolve") proof.requests[1].resolve();
    else proof.requests[1].reject(new Error("retry request"));
    await flushLoads();
    proof.layer.sync([proof.mid], 0);
    await proof.layer.applyImpulse(42);
    expect(proof.layer.hasActor(42)).toBe(false);
    expect(runtime.createActor).not.toHaveBeenCalled();
    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(proof.requests).toHaveLength(2);
    expect(proof.scene.children).toHaveLength(0);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("retries runtime startup on renewed demand and then reaches actor reconciliation", async () => {
    const proof = recoveryFixture();
    proof.loaded.add("crowd");
    createRuntime.mockRejectedValueOnce(new Error("runtime chunk unavailable"));
    try {
      proof.layer.sync([proof.mid], 0);
      await vi.waitFor(() => expect(proof.layer.getStats().loadState).toBe("failed"));
      for (let frame = 0; frame < 30; frame++) proof.layer.sync([proof.mid], 0);
      expect(createRuntime).toHaveBeenCalledOnce();
      proof.layer.sync([], 0);
      proof.layer.sync([proof.mid], 0);
      await vi.waitFor(() => expect(proof.layer.hasActor(42)).toBe(true));
      expect(createRuntime).toHaveBeenCalledTimes(2);
      expect(proof.layer.getStats().loadState).toBe("ready");
    } finally {
      proof.layer.dispose();
    }
  });
});

function recoveryFixture() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const loaded = new Set<string>();
  const requests: { resolve(): void; reject(error: Error): void }[] = [];
  runtime.areAssetsReady.mockImplementation((config: ProceduralUnitConfig) => loaded.has(config.humanoid.renderDetail));
  runtime.prepareAssets.mockImplementation(
    (config: ProceduralUnitConfig) =>
      new Promise<void>((resolve, reject) => {
        requests.push({
          resolve: () => {
            loaded.add(config.humanoid.renderDetail);
            resolve();
          },
          reject,
        });
      }),
  );
  runtime.createActor.mockImplementation(() => {
    const object = new Group();
    return {
      object,
      kind: "knight",
      mode: "animated",
      onRangedRelease: () => () => {},
      onMeleeContact: () => () => {},
      applyImpulse: vi.fn(),
      startRagdoll: vi.fn(),
      attack: vi.fn(() => true),
      dispose: () => object.removeFromParent(),
    };
  });
  const scene = new Scene();
  const mid = {
    entityId: 42,
    category: TroopType.Knight,
    tier: TroopTier.T1,
    isNaval: false,
    isMoving: false,
    primaryColor: "#ffffff",
    position: new Vector3(),
    distanceToCameraSquared: 400,
  };
  return {
    layer: new ProceduralArmyCharacterLayer(scene),
    scene,
    mid,
    near: { ...mid, distanceToCameraSquared: 100 },
    loaded,
    requests,
  };
}

const flushLoads = () => new Promise((resolve) => setTimeout(resolve, 0));
