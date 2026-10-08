// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultProceduralUnitConfig } from "./procedural-unit-config";
import { ProceduralUnitRuntime } from "./procedural-unit-runtime";

const runtimeMocks = vi.hoisted(() => ({
  characterCreateActor: vi.fn(),
  characterDispose: vi.fn(),
  physicsDispose: vi.fn(),
}));

vi.mock("./procedural-character-runtime", () => ({
  ProceduralCharacterRuntime: {
    create: vi.fn(async () => ({
      createActor: runtimeMocks.characterCreateActor,
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
    Object.values(runtimeMocks).forEach((mock) => mock.mockReset());
  });

  it("rejects unloaded direct Knight gear before creating a character actor", async () => {
    const runtime = await ProceduralUnitRuntime.create();
    const config = createUnavailableKnightGearConfig();

    expect(() => runtime.createActor(config)).toThrow("Knight gear t1-knight-default-sword was not loaded");
    expect(runtimeMocks.characterCreateActor).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("rejects unavailable review gear before mutating an existing actor", async () => {
    const runtime = await ProceduralUnitRuntime.create();
    const actor = { dispose: vi.fn(), updateConfig: vi.fn() };
    (runtime as unknown as { actors: Set<typeof actor> }).actors.add(actor);

    expect(() => runtime.updateActorConfig(actor as never, createUnavailableKnightGearConfig())).toThrow(
      "Knight gear t1-knight-default-sword was not loaded",
    );
    expect(actor.updateConfig).not.toHaveBeenCalled();
    runtime.dispose();
  });
});

function createUnavailableKnightGearConfig() {
  const config = createDefaultProceduralUnitConfig();
  config.kind = "knight";
  config.humanoid.appearanceId = "modular-fantasy";
  config.melee.weaponId = "t1-knight-default-sword";
  config.melee.offhandId = "t1-knight-default-shield";
  return config;
}
