// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { ProceduralCharacterPoseFilter } from "./procedural-character-pose-filter";
import { ProceduralCharacterRuntime } from "./procedural-character-runtime";
import { ProceduralPlantController } from "./procedural-plant-controller";

const runtimeMocks = vi.hoisted(() => ({
  avatarDispose: vi.fn(),
  avatarRebuild: vi.fn(),
  instantiate: vi.fn(),
  libraryDispose: vi.fn(),
  replaceActiveModel: vi.fn(),
}));

vi.mock("./procedural-character-assets", () => ({
  ProceduralCharacterLibrary: class {},
  loadProceduralCharacterLibrary: vi.fn(async () => ({
    dispose: runtimeMocks.libraryDispose,
    instantiate: runtimeMocks.instantiate,
  })),
}));

vi.mock("./procedural-character-avatar", async () => {
  const { Group } = await import("three");
  return {
    ProceduralCharacterAvatar: class {
      public readonly group = new Group();

      public applyPose(): void {}
      public dispose(): void {
        runtimeMocks.avatarDispose();
      }
      public measureActiveLimbLengths() {
        return {
          foot: { ankleHeight: 0.08, ballLength: 0.12, heelLength: 0.08 },
          forearmLength: 0.26,
          shinLength: 0.42,
          thighLength: 0.43,
          upperArmLength: 0.29,
        };
      }
      public rebuild(_rig: unknown, _config: unknown, replacement?: unknown): void {
        runtimeMocks.avatarRebuild(replacement);
        if (replacement) runtimeMocks.replaceActiveModel(replacement);
      }
      public updateConfig(): void {}
    },
  };
});

describe("procedural character runtime asset swaps", () => {
  beforeEach(() => {
    Object.values(runtimeMocks).forEach((mock) => mock.mockReset());
    runtimeMocks.instantiate.mockImplementation((appearanceId, tier, renderDetail) => ({
      appearanceId,
      renderDetail,
      tier,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the legacy model and animation state when detail resolves to the same asset", async () => {
    const plantReset = vi.spyOn(ProceduralPlantController.prototype, "reset");
    const poseReset = vi.spyOn(ProceduralCharacterPoseFilter.prototype, "reset");
    const runtime = await ProceduralCharacterRuntime.create();
    const hero = createDefaultProceduralCharacterConfig();
    const actor = runtime.createActor(hero);
    runtimeMocks.instantiate.mockClear();
    runtimeMocks.avatarRebuild.mockClear();
    runtimeMocks.replaceActiveModel.mockClear();
    plantReset.mockClear();
    poseReset.mockClear();

    actor.updateConfig({ ...hero, renderDetail: "crowd" });

    expect(runtimeMocks.instantiate).not.toHaveBeenCalled();
    expect(runtimeMocks.avatarRebuild).not.toHaveBeenCalled();
    expect(runtimeMocks.replaceActiveModel).not.toHaveBeenCalled();
    expect(plantReset).not.toHaveBeenCalled();
    expect(poseReset).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("replaces the Knight model and resets animation state when detail selects another LOD", async () => {
    const plantReset = vi.spyOn(ProceduralPlantController.prototype, "reset");
    const poseReset = vi.spyOn(ProceduralCharacterPoseFilter.prototype, "reset");
    const runtime = await ProceduralCharacterRuntime.create({ includeT1KnightDefault: true });
    const hero = {
      ...createDefaultProceduralCharacterConfig(),
      appearanceId: "t1-knight-default" as const,
    };
    const actor = runtime.createActor(hero);
    runtimeMocks.instantiate.mockClear();
    runtimeMocks.avatarRebuild.mockClear();
    runtimeMocks.replaceActiveModel.mockClear();
    plantReset.mockClear();
    poseReset.mockClear();

    actor.updateConfig({ ...hero, renderDetail: "crowd" });

    expect(runtimeMocks.instantiate).toHaveBeenCalledOnce();
    expect(runtimeMocks.instantiate).toHaveBeenCalledWith("t1-knight-default", hero.tier, "crowd");
    expect(runtimeMocks.replaceActiveModel).toHaveBeenCalledOnce();
    expect(plantReset).toHaveBeenCalledOnce();
    expect(poseReset).toHaveBeenCalledOnce();
    runtime.dispose();
  });

  it("keeps the existing model and config coherent when a replacement is unavailable", async () => {
    const plantReset = vi.spyOn(ProceduralPlantController.prototype, "reset");
    const poseReset = vi.spyOn(ProceduralCharacterPoseFilter.prototype, "reset");
    const runtime = await ProceduralCharacterRuntime.create();
    const hero = createDefaultProceduralCharacterConfig();
    const actor = runtime.createActor(hero);
    runtimeMocks.instantiate.mockClear();
    runtimeMocks.avatarRebuild.mockClear();
    plantReset.mockClear();
    poseReset.mockClear();
    runtimeMocks.instantiate.mockImplementationOnce(() => {
      throw new Error("Knight appearance was not loaded");
    });

    expect(() =>
      actor.updateConfig({
        ...hero,
        appearanceId: "t1-knight-default",
      }),
    ).toThrow("Knight appearance was not loaded");
    expect(runtimeMocks.avatarRebuild).not.toHaveBeenCalled();
    expect(plantReset).not.toHaveBeenCalled();
    expect(poseReset).not.toHaveBeenCalled();

    runtimeMocks.instantiate.mockClear();
    actor.updateConfig({ ...hero, renderDetail: "crowd" });
    expect(runtimeMocks.instantiate).not.toHaveBeenCalled();
    expect(runtimeMocks.avatarRebuild).not.toHaveBeenCalled();
    runtime.dispose();
  });
});
