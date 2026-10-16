// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "./procedural-unit-config";
import { ProceduralCharacterRuntime } from "./procedural-character-runtime";
import { ProceduralHorseRuntime } from "./horse/procedural-horse-runtime";
import { ProceduralDragonRuntime } from "./dragon/procedural-dragon-runtime";
import { ProceduralBoatRuntime } from "./boat/procedural-boat-runtime";
import { JoltRagdollWorld } from "./jolt-ragdoll-world";
import { ProceduralUnitRuntime } from "./procedural-unit-runtime";

const runtimeMocks = vi.hoisted(() => ({
  characterCreateActor: vi.fn(),
  characterPrepare: vi.fn(),
  characterReady: vi.fn(),
  characterDispose: vi.fn(),
  physicsDispose: vi.fn(),
}));

vi.mock("./procedural-character-runtime", () => ({
  ProceduralCharacterRuntime: {
    create: vi.fn(async () => ({
      createActor: runtimeMocks.characterCreateActor,
      prepareAssets: runtimeMocks.characterPrepare,
      areAssetsReady: runtimeMocks.characterReady,
      dispose: runtimeMocks.characterDispose,
    })),
  },
}));

vi.mock("./horse/procedural-horse-runtime", () => ({
  ProceduralHorseRuntime: { create: vi.fn(async () => ({ dispose: vi.fn() })) },
}));

vi.mock("./dragon/procedural-dragon-runtime", () => ({
  ProceduralDragonRuntime: { create: vi.fn(async () => ({ dispose: vi.fn() })) },
}));

vi.mock("./boat/procedural-boat-runtime", () => ({
  ProceduralBoatRuntime: { create: vi.fn(async () => ({ dispose: vi.fn() })) },
}));

vi.mock("./jolt-character-ragdoll", () => ({
  resolveJoltWorldConfig: vi.fn(() => ({})),
}));

vi.mock("./jolt-ragdoll-world", () => ({
  JoltRagdollWorld: {
    create: vi.fn(async () => ({
      dispose: runtimeMocks.physicsDispose,
    })),
  },
}));

describe("procedural unit runtime asset preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeMocks.characterReady.mockReturnValue(true);
  });

  it("starts with no model family or physics downloads", async () => {
    const runtime = await ProceduralUnitRuntime.create();
    expectRequestedFamilies([]);
    expect(JoltRagdollWorld.create).not.toHaveBeenCalled();
    runtime.dispose();
    expect(runtimeMocks.physicsDispose).not.toHaveBeenCalled();
  });

  it.each([
    ["knight", 1, ["character"]],
    ["archer", 2, ["character"]],
    ["crossbowman", 3, ["character"]],
    ["horse", 1, ["horse"]],
    ["dragon", 3, ["dragon"]],
    ["boat", 1, ["boat"]],
    ["paladin", 2, ["character", "horse"]],
    ["paladin", 3, ["character", "dragon"]],
  ] as const)("prepares only %s tier %s dependencies", async (kind, tier, expected) => {
    const runtime = await ProceduralUnitRuntime.create();
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
      kind,
      humanoid: { tier, appearanceId: "modular-fantasy" },
      dragon: { tier },
    });
    expect(runtime.areAssetsReady(config)).toBe(false);
    await Promise.all([runtime.prepareAssets(config), runtime.prepareAssets(config)]);
    expectRequestedFamilies(expected);
    expect(runtime.areAssetsReady(config)).toBe(true);
    if (expected.some((family) => family === "character"))
      expect(runtimeMocks.characterPrepare).toHaveBeenCalledWith(config.humanoid);
    else expect(runtimeMocks.characterPrepare).not.toHaveBeenCalled();
    expect(JoltRagdollWorld.create).toHaveBeenCalledTimes(
      expected.some((family) => family === "character" || family === "horse") ? 1 : 0,
    );
    await runtime.prepareAssets(config);
    expectRequestedFamilies(expected);
    runtime.dispose();
  });

  it("retries a rejected family without reloading an unrelated family", async () => {
    vi.mocked(ProceduralBoatRuntime.create).mockRejectedValueOnce(new Error("network"));
    const runtime = await ProceduralUnitRuntime.create();
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "boat" });
    await expect(runtime.prepareAssets(config)).rejects.toThrow("network");
    expect(runtime.areAssetsReady(config)).toBe(false);
    await runtime.prepareAssets(config);
    expect(runtime.areAssetsReady(config)).toBe(true);
    expect(ProceduralBoatRuntime.create).toHaveBeenCalledTimes(2);
    expect(ProceduralCharacterRuntime.create).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("disposes a family that finishes after the owning scene closes", async () => {
    let finish!: (runtime: Awaited<ReturnType<typeof ProceduralBoatRuntime.create>>) => void;
    vi.mocked(ProceduralBoatRuntime.create).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const runtime = await ProceduralUnitRuntime.create();
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "boat" });
    const pending = runtime.prepareAssets(config);
    runtime.dispose();
    const dispose = vi.fn();
    finish({ dispose } as never);
    await expect(pending).rejects.toThrow("closed during loading");
    expect(dispose).toHaveBeenCalledOnce();
    expect(runtime.areAssetsReady(config)).toBe(false);
  });

  it("rejects unloaded direct Knight gear before creating a character actor", async () => {
    const runtime = await ProceduralUnitRuntime.create();
    const config = createUnavailableKnightGearConfig();

    expect(() => runtime.createActor(config)).toThrow("Fitted gear t1-knight-default-sword was not loaded");
    expect(runtimeMocks.characterCreateActor).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("rejects Knight gear asked for on another rig before creating a character actor", async () => {
    const runtime = await ProceduralUnitRuntime.create();
    const config = createUnavailableKnightGearConfig();
    config.humanoid.appearanceId = "modular-fantasy";

    expect(() => runtime.createActor(config)).toThrow("fitted to t1-knight-default");
    expect(runtimeMocks.characterCreateActor).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("rejects unavailable review gear before mutating an existing actor", async () => {
    const runtime = await ProceduralUnitRuntime.create();
    const actor = { dispose: vi.fn(), updateConfig: vi.fn() };
    (runtime as unknown as { actors: Set<typeof actor> }).actors.add(actor);

    expect(() => runtime.updateActorConfig(actor as never, createUnavailableKnightGearConfig())).toThrow(
      "Fitted gear t1-knight-default-sword was not loaded",
    );
    expect(actor.updateConfig).not.toHaveBeenCalled();
    runtime.dispose();
  });
});

function createUnavailableKnightGearConfig() {
  const config = createDefaultProceduralUnitConfig();
  config.kind = "knight";
  config.humanoid.appearanceId = "t1-knight-default";
  config.melee.weaponId = "t1-knight-default-sword";
  config.melee.offhandId = "t1-knight-default-shield";
  return config;
}

function expectRequestedFamilies(expected: readonly string[]) {
  for (const [family, create] of Object.entries({
    character: ProceduralCharacterRuntime.create,
    horse: ProceduralHorseRuntime.create,
    dragon: ProceduralDragonRuntime.create,
    boat: ProceduralBoatRuntime.create,
  }))
    expect(create, family).toHaveBeenCalledTimes(expected.includes(family) ? 1 : 0);
}
