import { Group } from "three";
import { describe, expect, it, vi } from "vitest";

import { createDefaultProceduralUnitConfig } from "../procedural-unit-config";
import type { ProceduralHorseActor } from "../horse/procedural-horse-runtime";
import { ProceduralHorseMountActor } from "./procedural-horse-mount-actor";

describe("procedural horse mount actor", () => {
  it("presents the horse through the mounted-creature lifecycle", () => {
    const horse = createHorseActor();
    const mount = new ProceduralHorseMountActor(horse);
    const config = createDefaultProceduralUnitConfig();

    mount.updateConfig(config);

    expect(mount.kind).toBe("horse");
    expect(mount.object).toBe(horse.object);
    expect(mount.getPose()).toEqual({
      phase: 0.25,
      saddlePosition: [0, 1, 0],
      saddleRotation: [0, 0, 0, 1],
    });
    expect(mount.getStats()).toMatchObject({ kind: "horse", appearanceId: "quaternius", bodyCount: 17 });
    expect(horse.updateConfig).toHaveBeenCalledWith(config.horse, config.humanoid);
  });
});

function createHorseActor(): ProceduralHorseActor {
  return {
    applyImpact: vi.fn(async () => undefined),
    applyImpulse: vi.fn(async () => undefined),
    applyReaction: vi.fn(),
    dispose: vi.fn(),
    getPhysicsStats: vi.fn(() => ({
      activeBodyCount: 0,
      bodyCount: 17,
      constraintCount: 16,
      wasmHeapBytes: 0,
    })),
    getPose: vi.fn(
      () =>
        ({
          phase: 0.25,
          saddlePosition: [0, 1, 0],
          saddleRotation: [0, 0, 0, 1],
        }) as unknown as ReturnType<ProceduralHorseActor["getPose"]>,
    ),
    getPoseDiagnostics: vi.fn(() => ({ issues: [] }) as never),
    getStats: vi.fn(
      () =>
        ({
          appearanceId: "quaternius",
          appearanceLabel: "Quaternius Animated Animal",
          assetId: "quaternius-horse",
          assetLabel: "Quaternius horse",
          authoredClipCount: 13,
          boneCount: 50,
          maximumBoneStretchRatio: 1,
          minimumBendAlignment: 1,
          rigAdapterId: "quaternius-horse",
          skinnedMeshCount: 8,
          stanceHoofCount: 3,
        }) as ReturnType<ProceduralHorseActor["getStats"]>,
    ),
    hasFiniteState: vi.fn(() => true),
    mode: "animated",
    object: new Group(),
    reset: vi.fn(),
    setGroundSampler: vi.fn(),
    startRagdoll: vi.fn(async () => undefined),
    stepOnce: vi.fn(),
    update: vi.fn(),
    updateConfig: vi.fn(),
  };
}
