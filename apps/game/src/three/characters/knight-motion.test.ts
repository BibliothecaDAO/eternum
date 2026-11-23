import { Vector3 } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTextureFreeGlb } from "../../../test-support/parse-texture-free-glb";
import { KNIGHT_DEATH_DURATION_SECONDS, resolveKnightDeathPose } from "./knight-motion";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveCharacterRig } from "./procedural-character-rig";
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

const TARGET = new Vector3(0, 0.55, 1.2);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function withKnightRuntime<T>(run: (runtime: ProceduralUnitRuntime) => Promise<T>): Promise<T> {
  vi.stubGlobal("ProgressEvent", class extends Event {});
  const cache = new Map<string, Promise<GLTF>>();
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation((url) => {
    const key = String(url);
    if (!cache.has(key)) cache.set(key, parseTextureFreeGlb(key));
    return cache.get(key) as Promise<GLTF>;
  });
  const runtime = await ProceduralUnitRuntime.create();
  try {
    return await run(runtime);
  } finally {
    runtime.dispose();
  }
}

function createKnightConfig(animationMode: "idle" | "walk" | "run") {
  return applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
    kind: "knight",
    humanoid: { animationMode, appearanceId: "t1-knight-default", renderDetail: "hero", tier: 1 },
  });
}

function jointDistance(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe("Knight procedural hybrid motion", () => {
  it("moves visibly at rest during idle and swings arms with the march stride", async () => {
    await withKnightRuntime(async (runtime) => {
      const idleConfig = createKnightConfig("idle");
      await runtime.prepareAssets(idleConfig);
      const actor = runtime.createActor(idleConfig);
      try {
        actor.update(1 / 60);
        const idleStart = actor.getPoseDiagnostics().humanoid!.joints;
        let maxIdleHandTravel = 0;
        for (let frame = 0; frame < 90; frame++) {
          actor.update(1 / 60);
          const joints = actor.getPoseDiagnostics().humanoid!.joints;
          maxIdleHandTravel = Math.max(
            maxIdleHandTravel,
            jointDistance(idleStart.wristRight, joints.wristRight),
            jointDistance(idleStart.wristLeft, joints.wristLeft),
          );
        }
        expect(maxIdleHandTravel).toBeGreaterThan(0.002);

        runtime.updateActorConfig(actor, createKnightConfig("walk"));
        for (let frame = 0; frame < 15; frame++) actor.update(1 / 60);
        const marchStart = actor.getPoseDiagnostics().humanoid!.joints;
        let maxMarchArmTravel = 0;
        let maxMarchAnkleTravel = 0;
        for (let frame = 0; frame < 60; frame++) {
          actor.update(1 / 60);
          const joints = actor.getPoseDiagnostics().humanoid!.joints;
          maxMarchArmTravel = Math.max(maxMarchArmTravel, jointDistance(marchStart.wristRight, joints.wristRight));
          maxMarchAnkleTravel = Math.max(
            maxMarchAnkleTravel,
            jointDistance(marchStart.ankleLeft, joints.ankleLeft),
            jointDistance(marchStart.ankleRight, joints.ankleRight),
          );
        }
        expect(maxMarchArmTravel).toBeGreaterThan(0.015);
        expect(maxMarchAnkleTravel).toBeGreaterThan(0.08);
        expect(actor.hasFiniteState()).toBe(true);
      } finally {
        actor.dispose();
      }
    });
  });

  it("plays a melee attack once and returns cleanly to idle", async () => {
    await withKnightRuntime(async (runtime) => {
      const config = createKnightConfig("idle");
      await runtime.prepareAssets(config);
      const actor = runtime.createActor(config);
      try {
        expect(actor.attack(TARGET)).toBe(true);
        let sawActivePhase = false;
        for (let frame = 0; frame < 120; frame++) {
          actor.update(1 / 60);
          if (actor.getStats().meleePhase !== "idle") sawActivePhase = true;
        }
        expect(sawActivePhase).toBe(true);
        expect(actor.getStats().meleeContactCount).toBe(1);
        expect(actor.getStats().meleePhase).toBe("idle");
        expect(actor.hasFiniteState()).toBe(true);
      } finally {
        actor.dispose();
      }
    });
  });

  it("collapses cleanly to ground height on death without floor sinking or non-finite joints", async () => {
    await withKnightRuntime(async (runtime) => {
      const config = createKnightConfig("idle");
      await runtime.prepareAssets(config);
      const actor = runtime.createActor(config);
      try {
        actor.update(1 / 60);
        const standingPelvisY = actor.getPoseDiagnostics().humanoid!.joints.pelvis[1];
        actor.playDeath?.();
        const frames = Math.ceil(KNIGHT_DEATH_DURATION_SECONDS * 60) + 12;
        for (let frame = 0; frame < frames; frame++) {
          actor.update(1 / 60);
          expect(actor.hasFiniteState()).toBe(true);
        }
        const fallen = actor.getPoseDiagnostics().humanoid!.joints;
        expect(fallen.pelvis[1]).toBeLessThan(standingPelvisY * 0.55);
        expect(fallen.pelvis[1]).toBeGreaterThan(0.02);
        expect(fallen.head[1]).toBeGreaterThan(0.01);
        actor.reset();
        actor.update(1 / 60);
        expect(actor.getPoseDiagnostics().humanoid!.joints.pelvis[1]).toBeGreaterThan(standingPelvisY * 0.85);
      } finally {
        actor.dispose();
      }
    });
  });

  it("settles the death pose smoothly at completion", () => {
    const config = {
      ...createDefaultProceduralCharacterConfig(),
      appearanceId: "t1-knight-default" as const,
      tier: 1 as const,
    };
    const rig = resolveCharacterRig(config);
    const start = resolveKnightDeathPose(rig, config, 0.01);
    const end = resolveKnightDeathPose(rig, config, 1);
    const afterEnd = resolveKnightDeathPose(rig, config, 1.5);
    expect(end.parts.pelvis.position[1]).toBeLessThan(start.parts.pelvis.position[1] * 0.45);
    expect(afterEnd.parts.pelvis.position).toEqual(end.parts.pelvis.position);
  });
});
