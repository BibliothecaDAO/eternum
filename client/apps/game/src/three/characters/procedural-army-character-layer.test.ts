import { TroopTier, TroopType } from "@bibliothecadao/types";
import { Euler, Group, Raycaster, Scene, Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProceduralArmyCharacterLayer } from "./procedural-army-character-layer";

const characterMocks = vi.hoisted(() => ({
  createActor: vi.fn(),
  createRuntime: vi.fn(),
  disposeRuntime: vi.fn(),
  updateRuntime: vi.fn(),
  updateRuntimeActorConfig: vi.fn(),
}));

vi.mock("@/three/characters", () => ({
  applyProceduralUnitConfigPatch: (
    current: { horse: Record<string, unknown>; humanoid: Record<string, unknown> },
    patch: Record<string, unknown> & {
      horse?: Record<string, unknown>;
      humanoid?: Record<string, unknown>;
    },
  ) => ({
    ...current,
    ...patch,
    horse: { ...current.horse, ...patch.horse },
    humanoid: { ...current.humanoid, ...patch.humanoid },
  }),
  createDefaultProceduralUnitConfig: () => ({
    kind: "paladin",
    horse: { gait: "idle", primaryColor: "#315f86", tier: 1 },
    humanoid: { animationMode: "mounted", autoRotate: false, primaryColor: "#315f86", seed: 0, tier: 1 },
  }),
  ProceduralUnitRuntime: {
    create: characterMocks.createRuntime,
  },
}));

describe("ProceduralArmyCharacterLayer", () => {
  beforeEach(() => {
    characterMocks.createActor.mockReset();
    characterMocks.createRuntime.mockReset();
    characterMocks.disposeRuntime.mockReset();
    characterMocks.updateRuntime.mockReset();
    characterMocks.updateRuntimeActorConfig.mockReset();
  });

  it("lazy-loads one shared runtime and drives a promoted live-army actor", async () => {
    const scene = new Scene();
    const actor = createActorMock("paladin");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue({
      createActor: characterMocks.createActor,
      dispose: characterMocks.disposeRuntime,
      update: characterMocks.updateRuntime,
      updateActorConfig: characterMocks.updateRuntimeActorConfig,
    });
    const layer = new ProceduralArmyCharacterLayer(scene);
    const onRangedRelease = vi.fn();
    const onMeleeContact = vi.fn();
    layer.onRangedRelease(onRangedRelease);
    layer.onMeleeContact(onMeleeContact);
    const presentation = {
      attachments: [
        { id: "winter-paladin-primary", slot: "weapon" },
        { id: "winter-paladin-secondary", slot: "offhand" },
      ],
      category: TroopType.Paladin,
      entityId: 42,
      isMoving: false,
      position: new Vector3(3, 0.5, 7),
      primaryColor: "#ff6600",
      rotation: new Euler(0, 1.2, 0),
      tier: TroopTier.T3,
    };

    layer.sync([presentation], 0.016);
    await vi.waitFor(() => expect(layer.hasActor(42)).toBe(true));

    expect(characterMocks.createRuntime).toHaveBeenCalledTimes(1);
    expect(characterMocks.createActor).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "paladin",
        horse: expect.objectContaining({ gait: "idle", primaryColor: "#ff6600", tier: 3 }),
        humanoid: expect.objectContaining({ animationMode: "mounted", primaryColor: "#ff6600", seed: 42, tier: 3 }),
        melee: expect.objectContaining({
          offhandId: "winter-rider-shield",
          weaponId: "winter-rider-battleaxe",
        }),
      }),
    );
    expect(scene.getObjectByName("procedural-army-character:42")).toBe(actor.object);
    expect(actor.object.position.toArray()).toEqual([3, 0.5, 7]);
    expect(characterMocks.updateRuntime).toHaveBeenCalledWith(0);
    expect(layer.getStats()).toMatchObject({ actorCount: 1, hitTargetCount: 1, loadState: "ready" });

    layer.sync([{ ...presentation, isMoving: true, position: new Vector3(4, 0.5, 8) }], 0.02);

    expect(characterMocks.updateRuntimeActorConfig).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ horse: expect.objectContaining({ gait: "walk" }) }),
    );
    expect(actor.object.position.toArray()).toEqual([4, 0.5, 8]);
    expect(characterMocks.updateRuntime).toHaveBeenLastCalledWith(0.02);

    const rangedEvent = {
      direction: new Vector3(0, 0, 1),
      origin: new Vector3(4, 1, 8),
      seed: 42,
      shotGeneration: 1,
      target: new Vector3(5, 1, 8),
    };
    const meleeEvent = {
      attackGeneration: 1,
      direction: new Vector3(1, 0, 0),
      impactStrength: 1,
      origin: new Vector3(4, 1, 8),
      target: new Vector3(5, 1, 8),
      weaponId: "iron-longsword" as const,
    };
    actor.emitRangedRelease(rangedEvent);
    actor.emitMeleeContact(meleeEvent);
    expect(onRangedRelease).toHaveBeenCalledWith(42, rangedEvent);
    expect(onMeleeContact).toHaveBeenCalledWith(42, meleeEvent);

    await layer.startRagdoll(42);
    await layer.applyImpulse(42);
    await layer.playAttack(42, new Vector3(5, 0.5, 8));
    layer.reset(42);

    expect(actor.startRagdoll).toHaveBeenCalledOnce();
    expect(actor.applyImpulse).toHaveBeenCalledOnce();
    expect(actor.attack).toHaveBeenCalledOnce();
    expect(actor.reset).toHaveBeenCalledOnce();

    layer.sync([], 0);
    expect(actor.dispose).toHaveBeenCalledOnce();
    expect(layer.hasActor(42)).toBe(false);

    layer.dispose();
    expect(characterMocks.disposeRuntime).toHaveBeenCalledOnce();
  });

  it("keeps hidden interaction proxies selectable after the legacy mesh is replaced", async () => {
    const actor = createActorMock("knight");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue({
      createActor: characterMocks.createActor,
      dispose: characterMocks.disposeRuntime,
      update: characterMocks.updateRuntime,
      updateActorConfig: characterMocks.updateRuntimeActorConfig,
    });
    const layer = new ProceduralArmyCharacterLayer(new Scene());

    layer.sync(
      [
        {
          category: TroopType.Knight,
          entityId: 91,
          isMoving: false,
          position: new Vector3(),
          primaryColor: "#315f86",
          tier: TroopTier.T1,
        },
      ],
      0,
    );
    await vi.waitFor(() => expect(layer.hasActor(91)).toBe(true));

    const raycaster = new Raycaster(new Vector3(0, 1, 5), new Vector3(0, 0, -1));
    expect(layer.raycastNearest(raycaster)).toMatchObject({ entityId: 91 });

    layer.sync([], 0);
    expect(layer.raycastNearest(raycaster)).toBeUndefined();
    layer.dispose();
  });

  it("hands defeated actors to a bounded-lived ragdoll presentation", async () => {
    const actor = createActorMock("knight");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue({
      createActor: characterMocks.createActor,
      dispose: characterMocks.disposeRuntime,
      update: characterMocks.updateRuntime,
      updateActorConfig: characterMocks.updateRuntimeActorConfig,
    });
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentation = {
      category: TroopType.Knight,
      entityId: 92,
      isMoving: false,
      position: new Vector3(),
      primaryColor: "#315f86",
      tier: TroopTier.T1,
    };

    layer.sync([presentation], 0);
    await vi.waitFor(() => expect(layer.hasActor(92)).toBe(true));

    expect(layer.playDefeat(92)).toBe(true);
    expect(layer.hasActor(92)).toBe(false);
    expect(layer.getStats()).toMatchObject({ actorCount: 0, defeatedActorCount: 1, hitTargetCount: 0 });
    expect(actor.applyImpulse).toHaveBeenCalledOnce();

    layer.sync([], 1);
    layer.sync([], 1);
    expect(actor.dispose).not.toHaveBeenCalled();
    layer.sync([], 1);
    expect(actor.dispose).toHaveBeenCalledOnce();
    expect(layer.getStats().defeatedActorCount).toBe(0);
    layer.dispose();
  });

  it("presents the ranged family as a longbow archer outside its crossbow tier", async () => {
    const actor = createActorMock("archer");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue({
      createActor: characterMocks.createActor,
      dispose: characterMocks.disposeRuntime,
      update: characterMocks.updateRuntime,
      updateActorConfig: characterMocks.updateRuntimeActorConfig,
    });
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentation = {
      category: TroopType.Crossbowman,
      entityId: 81,
      isMoving: false,
      position: new Vector3(),
      primaryColor: "#315f86",
      tier: TroopTier.T1,
    };

    layer.sync([presentation], 0);
    await vi.waitFor(() => expect(layer.hasActor(81)).toBe(true));
    expect(characterMocks.createActor).toHaveBeenCalledWith(expect.objectContaining({ kind: "archer" }));

    layer.sync([{ ...presentation, tier: TroopTier.T2 }], 0);
    expect(characterMocks.updateRuntimeActorConfig).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ kind: "crossbowman" }),
    );
    layer.dispose();
  });

  it("recreates the actor when an army changes between mounted and foot families", async () => {
    const mounted = createActorMock("paladin");
    const foot = createActorMock("knight");
    characterMocks.createActor.mockReturnValueOnce(mounted).mockReturnValueOnce(foot);
    characterMocks.createRuntime.mockResolvedValue({
      createActor: characterMocks.createActor,
      dispose: characterMocks.disposeRuntime,
      update: characterMocks.updateRuntime,
      updateActorConfig: characterMocks.updateRuntimeActorConfig,
    });
    const scene = new Scene();
    const layer = new ProceduralArmyCharacterLayer(scene);
    const presentation = {
      category: TroopType.Paladin,
      entityId: 101,
      isMoving: false,
      position: new Vector3(),
      primaryColor: "#315f86",
      tier: TroopTier.T1,
    };

    layer.sync([presentation], 0);
    await vi.waitFor(() => expect(layer.hasActor(101)).toBe(true));
    layer.sync([{ ...presentation, category: TroopType.Knight }], 0);

    expect(mounted.dispose).toHaveBeenCalledOnce();
    expect(characterMocks.createActor).toHaveBeenCalledTimes(2);
    expect(scene.getObjectByName("procedural-army-character:101")).toBe(foot.object);
    layer.dispose();
  });

  it("spreads ambient actor creation across frames while fallbacks remain available", async () => {
    characterMocks.createActor.mockImplementation((config: { kind: "knight" }) => createActorMock(config.kind));
    characterMocks.createRuntime.mockResolvedValue({
      createActor: characterMocks.createActor,
      dispose: characterMocks.disposeRuntime,
      update: characterMocks.updateRuntime,
      updateActorConfig: characterMocks.updateRuntimeActorConfig,
    });
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentations = Array.from({ length: 6 }, (_, index) => ({
      category: TroopType.Knight,
      entityId: 200 + index,
      isMoving: false,
      position: new Vector3(index, 0, 0),
      primaryColor: "#315f86",
      tier: TroopTier.T1,
    }));

    layer.sync(presentations, 0);
    await vi.waitFor(() => expect(characterMocks.createActor).toHaveBeenCalledTimes(4));
    expect(layer.getStats().actorCount).toBe(4);

    layer.sync(presentations, 1 / 60);
    expect(characterMocks.createActor).toHaveBeenCalledTimes(6);
    expect(layer.getStats().actorCount).toBe(6);
    layer.dispose();
  });

  it("leaves the legacy fallback active when the shared runtime fails to load", async () => {
    const loadError = new Error("runtime unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    characterMocks.createRuntime.mockRejectedValue(loadError);
    const layer = new ProceduralArmyCharacterLayer(new Scene());

    layer.sync(
      [
        {
          category: TroopType.Knight,
          entityId: 301,
          isMoving: false,
          position: new Vector3(),
          primaryColor: "#315f86",
          tier: TroopTier.T1,
        },
      ],
      0,
    );

    await vi.waitFor(() => expect(layer.getStats().loadState).toBe("failed"));
    expect(layer.hasActor(301)).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "[ProceduralArmyCharacterLayer] Failed to load the articulated character runtime",
      loadError,
    );
    consoleError.mockRestore();
    layer.dispose();
  });

  it("disposes a runtime that finishes loading after its scene layer was destroyed", async () => {
    let resolveRuntime!: (runtime: {
      createActor: typeof characterMocks.createActor;
      dispose: typeof characterMocks.disposeRuntime;
      update: typeof characterMocks.updateRuntime;
      updateActorConfig: typeof characterMocks.updateRuntimeActorConfig;
    }) => void;
    characterMocks.createRuntime.mockReturnValue(
      new Promise((resolve) => {
        resolveRuntime = resolve;
      }),
    );
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    layer.sync(
      [
        {
          category: TroopType.Knight,
          entityId: 302,
          isMoving: false,
          position: new Vector3(),
          primaryColor: "#315f86",
          tier: TroopTier.T1,
        },
      ],
      0,
    );

    layer.dispose();
    resolveRuntime({
      createActor: characterMocks.createActor,
      dispose: characterMocks.disposeRuntime,
      update: characterMocks.updateRuntime,
      updateActorConfig: characterMocks.updateRuntimeActorConfig,
    });

    await vi.waitFor(() => expect(characterMocks.disposeRuntime).toHaveBeenCalledOnce());
    expect(characterMocks.createActor).not.toHaveBeenCalled();
  });
});

function createActorMock(kind: "archer" | "crossbowman" | "knight" | "paladin") {
  const object = new Group();
  const meleeListeners = new Set<(event: unknown) => void>();
  const rangedListeners = new Set<(event: unknown) => void>();
  return {
    kind,
    object,
    applyImpulse: vi.fn(async () => undefined),
    attack: vi.fn(() => true),
    dispose: vi.fn(() => object.removeFromParent()),
    fireRangedAttack: vi.fn(() => false),
    getStats: vi.fn(),
    hasFiniteState: vi.fn(() => true),
    mode: "animated" as const,
    emitMeleeContact: (event: unknown) => meleeListeners.forEach((listener) => listener(event)),
    emitRangedRelease: (event: unknown) => rangedListeners.forEach((listener) => listener(event)),
    onMeleeContact: vi.fn((listener: (event: unknown) => void) => {
      meleeListeners.add(listener);
      return () => meleeListeners.delete(listener);
    }),
    onRangedRelease: vi.fn((listener: (event: unknown) => void) => {
      rangedListeners.add(listener);
      return () => rangedListeners.delete(listener);
    }),
    reset: vi.fn(),
    startRagdoll: vi.fn(async () => undefined),
    stepOnce: vi.fn(),
    update: vi.fn(() => 0),
    updateConfig: vi.fn(),
  };
}
