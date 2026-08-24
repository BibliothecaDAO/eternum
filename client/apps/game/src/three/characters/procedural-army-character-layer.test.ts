import { TroopTier, TroopType } from "@bibliothecadao/types";
import { Euler, Group, Raycaster, Scene, Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProceduralArmyCharacterLayer } from "./procedural-army-character-layer";

const characterMocks = vi.hoisted(() => ({
  createActor: vi.fn(),
  createRuntime: vi.fn(),
  disposeRuntime: vi.fn(),
  updatePhysicsConfig: vi.fn(),
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
    characterMocks.updatePhysicsConfig.mockReset();
    characterMocks.updateRuntime.mockReset();
    characterMocks.updateRuntimeActorConfig.mockReset();
  });

  it("lazy-loads one shared runtime and drives a promoted live-army actor", async () => {
    const scene = new Scene();
    const actor = createActorMock("paladin");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
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
      isNaval: false,
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
    expect(onRangedRelease).toHaveBeenCalledWith(42, rangedEvent, undefined, "provisional");
    expect(onMeleeContact).toHaveBeenCalledWith(42, meleeEvent, undefined, "provisional");

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
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());

    layer.sync(
      [
        {
          category: TroopType.Knight,
          entityId: 91,
          isNaval: false,
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

  it("applies bounded presentation separation and emits contact reactions without moving authoritative anchors", async () => {
    const left = createActorMock("knight");
    const right = createActorMock("knight");
    characterMocks.createActor.mockReturnValueOnce(left).mockReturnValueOnce(right);
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentations = [
      {
        category: TroopType.Knight,
        entityId: 1,
        isNaval: false,
        isMoving: true,
        position: new Vector3(-0.1, 0.5, 0),
        primaryColor: "#315f86",
        tier: TroopTier.T1,
      },
      {
        category: TroopType.Knight,
        entityId: 2,
        isNaval: false,
        isMoving: true,
        position: new Vector3(0.1, 0.5, 0),
        primaryColor: "#315f86",
        tier: TroopTier.T1,
      },
    ];

    layer.sync(presentations, 0);
    await vi.waitFor(() => expect(layer.getStats().actorCount).toBe(2));
    layer.sync(presentations, 1 / 60);

    expect(left.object.position.x).toBeLessThan(presentations[0].position.x);
    expect(right.object.position.x).toBeGreaterThan(presentations[1].position.x);
    expect(left.object.position.y).toBe(0.5);
    expect(right.object.position.y).toBe(0.5);
    expect(left.applyReaction).toHaveBeenCalledWith(expect.objectContaining({ source: "body-contact" }));
    expect(right.applyReaction).toHaveBeenCalledWith(expect.objectContaining({ source: "body-contact" }));
    expect(layer.getStats()).toMatchObject({ collisionBodyCount: 2, collisionPairCount: expect.any(Number) });
    layer.dispose();
  });

  it("hands defeated actors to a bounded-lived ragdoll presentation", async () => {
    const actor = createActorMock("knight");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentation = {
      category: TroopType.Knight,
      entityId: 92,
      isNaval: false,
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

  it("queries the intended actor and consumes its latest arrow impact for directional defeat", async () => {
    const actor = createActorMock("knight");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    layer.sync(
      [
        {
          category: TroopType.Knight,
          entityId: 55,
          isNaval: false,
          isMoving: false,
          position: new Vector3(),
          primaryColor: "#315f86",
          tier: TroopTier.T1,
        },
      ],
      0,
    );
    await vi.waitFor(() => expect(layer.hasActor(55)).toBe(true));

    const hit = layer.sweepProjectile({
      from: new Vector3(0, 0.8, 4),
      intendedTargetEntityId: 55,
      ownerEntityId: 9,
      radius: 0.04,
      to: new Vector3(0, 0.8, -4),
    });
    expect(hit).toMatchObject({ material: "metal", partId: "chest", targetEntityId: 55 });

    expect(
      layer.presentProjectileImpact({
        authority: "indexed-replay",
        impactId: "arrow:55",
        kind: "arrow",
        material: "metal",
        normal: new Vector3(0, 0, 1),
        ownerEntityId: 9,
        partId: "chest",
        position: hit!.point,
        targetEntityId: 55,
        targetHit: true,
        velocity: new Vector3(0, 0, -12),
      }),
    ).toBe(true);
    expect(actor.applyReaction).toHaveBeenCalledWith(
      expect.objectContaining({ source: "arrow", strength: expect.closeTo(9.6, 5) }),
    );

    expect(layer.playDefeat(55)).toBe(true);
    expect(actor.applyImpact).toHaveBeenCalledWith(
      expect.objectContaining({ directionZ: -1, impactId: "arrow:55", targetEntityId: 55 }),
    );
    expect(actor.applyImpulse).not.toHaveBeenCalled();
    layer.dispose();
  });

  it("keeps an expected ranged target hittable until its authoritative defeat receives the arrow", async () => {
    const archer = createActorMock("archer");
    const target = createActorMock("knight");
    characterMocks.createActor.mockReturnValueOnce(archer).mockReturnValueOnce(target);
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    layer.sync(
      [
        {
          category: TroopType.Crossbowman,
          entityId: 9,
          isNaval: false,
          isMoving: false,
          position: new Vector3(0, 0, 3),
          primaryColor: "#315f86",
          tier: TroopTier.T1,
        },
        {
          category: TroopType.Knight,
          entityId: 55,
          isNaval: false,
          isMoving: false,
          position: new Vector3(),
          primaryColor: "#315f86",
          tier: TroopTier.T1,
        },
      ],
      0,
    );
    await vi.waitFor(() => expect(layer.getStats().actorCount).toBe(2));

    expect(layer.playAttack(9, new Vector3(), 55, "indexed-replay")).toBe(true);
    expect(layer.playDefeat(55)).toBe(true);
    expect(target.applyImpulse).not.toHaveBeenCalled();

    const hit = layer.sweepProjectile({
      from: new Vector3(0, 0.8, 4),
      intendedTargetEntityId: 55,
      ownerEntityId: 9,
      radius: 0.04,
      to: new Vector3(0, 0.8, -4),
    });
    expect(hit).toMatchObject({ targetEntityId: 55 });
    expect(
      layer.presentProjectileImpact({
        authority: "indexed-replay",
        impactId: "delayed-arrow:55",
        kind: "arrow",
        material: "metal",
        normal: new Vector3(0, 0, 1),
        ownerEntityId: 9,
        partId: "chest",
        position: hit!.point,
        targetEntityId: 55,
        targetHit: true,
        velocity: new Vector3(0, 0, -12),
      }),
    ).toBe(true);
    expect(target.applyImpact).toHaveBeenCalledWith(
      expect.objectContaining({ directionZ: -1, impactId: "delayed-arrow:55" }),
    );
    expect(target.applyImpulse).not.toHaveBeenCalled();
    layer.dispose();
  });

  it("presents the ranged family as a longbow archer outside its crossbow tier", async () => {
    const actor = createActorMock("archer");
    characterMocks.createActor.mockReturnValue(actor);
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentation = {
      category: TroopType.Crossbowman,
      entityId: 81,
      isNaval: false,
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
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const scene = new Scene();
    const layer = new ProceduralArmyCharacterLayer(scene);
    const presentation = {
      category: TroopType.Paladin,
      entityId: 101,
      isNaval: false,
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

  it("promotes water movement to a procedural combat ship and restores the land actor at shore", async () => {
    const boat = createActorMock("boat");
    const knight = createActorMock("knight");
    characterMocks.createActor.mockReturnValueOnce(boat).mockReturnValueOnce(knight);
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentation = {
      category: TroopType.Knight,
      entityId: 151,
      isMoving: true,
      isNaval: true,
      position: new Vector3(),
      primaryColor: "#a86435",
      tier: TroopTier.T2,
    };

    layer.sync([presentation], 0);
    await vi.waitFor(() => expect(layer.hasActor(151)).toBe(true));
    expect(characterMocks.createActor).toHaveBeenCalledWith(
      expect.objectContaining({
        boat: expect.objectContaining({ broadsideCannons: 4, motionMode: "sail", tier: 2 }),
        kind: "boat",
      }),
    );
    expect(
      layer.sweepProjectile({
        from: new Vector3(0, 0.8, 4),
        intendedTargetEntityId: 151,
        ownerEntityId: 9,
        radius: 0.04,
        to: new Vector3(0, 0.8, -4),
      }),
    ).toMatchObject({ material: "wood", targetEntityId: 151 });

    layer.sync([{ ...presentation, isNaval: false }], 0);
    expect(boat.dispose).toHaveBeenCalledOnce();
    expect(characterMocks.createActor).toHaveBeenCalledTimes(2);
    expect(characterMocks.createActor).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "knight" }));
    layer.dispose();
  });

  it("spreads ambient actor creation across frames while fallbacks remain available", async () => {
    characterMocks.createActor.mockImplementation((config: { kind: "knight" }) => createActorMock(config.kind));
    characterMocks.createRuntime.mockResolvedValue(createRuntimeMock());
    const layer = new ProceduralArmyCharacterLayer(new Scene());
    const presentations = Array.from({ length: 6 }, (_, index) => ({
      category: TroopType.Knight,
      entityId: 200 + index,
      isNaval: false,
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
          isNaval: false,
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
      "[ProceduralArmyCharacterLayer] Failed to load the procedural unit runtime",
      loadError,
    );
    consoleError.mockRestore();
    layer.dispose();
  });

  it("disposes a runtime that finishes loading after its scene layer was destroyed", async () => {
    let resolveRuntime!: (runtime: ReturnType<typeof createRuntimeMock>) => void;
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
          isNaval: false,
          isMoving: false,
          position: new Vector3(),
          primaryColor: "#315f86",
          tier: TroopTier.T1,
        },
      ],
      0,
    );

    layer.dispose();
    resolveRuntime(createRuntimeMock());

    await vi.waitFor(() => expect(characterMocks.disposeRuntime).toHaveBeenCalledOnce());
    expect(characterMocks.createActor).not.toHaveBeenCalled();
  });
});

function createRuntimeMock() {
  return {
    createActor: characterMocks.createActor,
    dispose: characterMocks.disposeRuntime,
    update: characterMocks.updateRuntime,
    updateActorConfig: characterMocks.updateRuntimeActorConfig,
    updatePhysicsConfig: characterMocks.updatePhysicsConfig,
  };
}

function createActorMock(kind: "archer" | "boat" | "crossbowman" | "knight" | "paladin") {
  const object = new Group();
  const meleeListeners = new Set<(event: unknown) => void>();
  const rangedListeners = new Set<(event: unknown) => void>();
  return {
    kind,
    object,
    applyImpact: vi.fn(async () => undefined),
    applyImpulse: vi.fn(async () => undefined),
    applyReaction: vi.fn(),
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
