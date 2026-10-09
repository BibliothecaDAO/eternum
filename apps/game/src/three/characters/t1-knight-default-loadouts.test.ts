// @vitest-environment node
import { Vector3 } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTextureFreeGlb } from "../../../test-support/parse-texture-free-glb";
import {
  PROCEDURAL_MELEE_OFFHANDS,
  PROCEDURAL_MELEE_WEAPONS,
  isProceduralMeleeGearFittedToRig,
} from "./melee/procedural-melee-weapon-catalog";
import {
  resolveProceduralCharacterAppearance,
  type ProceduralCharacterAppearanceId,
} from "./procedural-character-appearance";
import type { ProceduralCharacterRenderDetail } from "./procedural-character-config";
import { createDefaultProceduralUnitConfig, type ProceduralUnitConfig } from "./procedural-unit-config";
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
  JoltRagdollWorld: { create: vi.fn(async () => ({ dispose: vi.fn() })) },
}));

const APPEARANCES: readonly ProceduralCharacterAppearanceId[] = [
  "modular-fantasy",
  "universal-base",
  "t1-knight-default",
];
const RENDER_DETAILS: readonly ProceduralCharacterRenderDetail[] = ["hero", "crowd"];
/** Acquire to recover of one attack at the default timings, with a few frames to spare. */
const ATTACK_FRAMES = 80;
const TARGET = new Vector3(0, 1.25, 1.5);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Every loadout the gym offers a knight with the review flag on: gear without a fitted rig fits every rig. */
function listOfferedKnightLoadouts(): ProceduralUnitConfig[] {
  return APPEARANCES.flatMap((appearanceId) => {
    const { rigAdapterId } = resolveProceduralCharacterAppearance(appearanceId);
    const fits = (gear: Parameters<typeof isProceduralMeleeGearFittedToRig>[0]) =>
      isProceduralMeleeGearFittedToRig(gear, rigAdapterId);
    return PROCEDURAL_MELEE_WEAPONS.filter(fits).flatMap((weapon) =>
      PROCEDURAL_MELEE_OFFHANDS.filter(fits).flatMap((offhand) =>
        RENDER_DETAILS.map((renderDetail) => {
          const config = createDefaultProceduralUnitConfig();
          config.kind = "knight";
          config.humanoid = { ...config.humanoid, animationMode: "idle", appearanceId, renderDetail, tier: 1 };
          config.melee = { ...config.melee, offhandId: offhand.id, weaponId: weapon.id };
          return config;
        }),
      ),
    );
  });
}

async function withRealGlbs(run: () => Promise<void>): Promise<void> {
  vi.stubGlobal("ProgressEvent", class extends Event {});
  const cache = new Map<string, Promise<GLTF>>();
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation((url) => {
    const key = String(url);
    if (!cache.has(key)) cache.set(key, parseTextureFreeGlb(key));
    return cache.get(key) as Promise<GLTF>;
  });
  await run();
}

describe("T1 Knight Default loadouts", () => {
  it("attack without throwing for every weapon and offhand the gym offers, the Knight's gear with plain gear too", async () => {
    await withRealGlbs(async () => {
      const runtime = await ProceduralUnitRuntime.create({ includeT1KnightDefault: true });
      const loadouts = listOfferedKnightLoadouts();
      const mixed = loadouts.filter(
        ({ humanoid, melee }) =>
          humanoid.appearanceId === "t1-knight-default" &&
          (melee.weaponId === "t1-knight-default-sword") !== (melee.offhandId === "t1-knight-default-shield"),
      );
      expect(mixed.length).toBeGreaterThan(0);
      try {
        for (const config of loadouts) {
          const label = `${config.humanoid.appearanceId} ${config.melee.weaponId} ${config.melee.offhandId} ${config.humanoid.renderDetail}`;
          const actor = runtime.createActor(config);
          try {
            expect(actor.attack(TARGET), label).toBe(true);
            for (let frame = 0; frame < ATTACK_FRAMES; frame++) actor.update(1 / 60);
            expect(actor.hasFiniteState(), label).toBe(true);
            expect(actor.getStats().meleeContactCount, label).toBe(1);
          } finally {
            actor.dispose();
          }
        }
      } finally {
        runtime.dispose();
      }
    });
  }, 300_000);
});
