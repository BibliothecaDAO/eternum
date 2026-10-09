// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { withCharacterLibrary } from "../../../test-support/with-character-library";
import { createIdleProceduralMeleeAttackState } from "./melee/procedural-melee-attack-cycle";
import { createDefaultProceduralMeleeConfig } from "./melee/procedural-melee-config";
import { resolveProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import { ProceduralCharacterAvatar } from "./procedural-character-avatar";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose, type ProceduralCharacterPose } from "./procedural-character-pose";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";
import { loadQuaterniusCharacterAssetTemplates } from "./quaternius-character-assets";

/**
 * The trunk of a `modular-fantasy` figure as the controller poses it, per pose `<mode>-<seconds>-<base|melee>`: pelvis,
 * chest and head rotations (x, y, z, w each), the pelvis position, then the left and right ankle targets. Gear that
 * declares no body poses keeps these values.
 */
const TRUNK_POSES: Readonly<Record<string, readonly number[]>> = {
  "idle-0.1-base": [
    0, 0, 0, 1, 0, 0.000377, 0, 1, 0, 6.8e-5, 0, 1, -0.000765, 1.11955, 0, 0.100465, 0.105826, -0.052222, -0.100465,
    0.105826, -0.052222,
  ],
  "walk-0.35-base": [
    0.011198, 0.008723, -9.5e-5, 0.999899, 0.019948, -0.014164, 0.003159, 0.999696, 0.004193, -0.002533, -0.001043,
    0.999987, 0.00112, 1.116634, 0.001857, 0.067994, 0.112991, 0.171941, -0.07529, 0.166987, -0.125206,
  ],
  "run-0.35-base": [
    0.03558, 0.029123, -0.012704, 0.998862, 0.05904, -0.079519, 0.004503, 0.995073, 0.004825, -0.014241, -0.002856,
    0.999883, 0.022184, 1.109996, 0.002824, 0.048501, 0.105826, -0.062111, -0.048501, 0.342914, 0.178094,
  ],
  "idle-0.1-melee": [
    0.008745, -0.004659, 0.001044, 0.99995, 0.004998, -0.001685, -0.012419, 0.999909, 0.023308, 0.055881, 0.007453,
    0.998138, 0.010056, 1.091065, 0.036656, 0.100465, 0.105826, -0.052222, -0.100465, 0.105826, -0.052222,
  ],
  "walk-0.35-melee": [
    0.01995, 0.004051, 0.00082, 0.999792, 0.02513, -0.015961, -0.009225, 0.999514, 0.027532, 0.053228, 0.006706,
    0.99818, 0.011941, 1.088149, 0.038512, 0.067994, 0.112991, 0.171941, -0.07529, 0.166987, -0.125206,
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function readTrunk(pose: ProceduralCharacterPose): number[] {
  return [
    ...pose.parts.pelvis.quaternion,
    ...pose.parts.chest.quaternion,
    ...pose.parts.head.quaternion,
    ...pose.parts.pelvis.position,
    ...pose.feet.left.target,
    ...pose.feet.right.target,
  ];
}

describe("Quaternius trunk", () => {
  it("keeps its pelvis, chest, head and feet: the gear declares no body poses", async () => {
    await withCharacterLibrary(
      {
        loadTemplates: loadQuaterniusCharacterAssetTemplates,
        urls: [
          "/models/characters/quaternius/base-male.glb",
          "/models/characters/quaternius/peasant-male.glb",
          "/models/characters/quaternius/ranger-male.glb",
        ],
      },
      (library) => {
        const config = { ...createDefaultProceduralCharacterConfig(), tier: 1 as const };
        expect(config.appearanceId).toBe("modular-fantasy");
        const strike = resolveProceduralMeleeUpperBodyPose({
          aimPitchRadians: 0.1,
          aimYawRadians: 0.2,
          attackStyle: "slash",
          config: createDefaultProceduralMeleeConfig("knight"),
          holds: { guard: 0, move: 0, run: 0 },
          seed: 0,
          mounted: false,
          state: { ...createIdleProceduralMeleeAttackState(), phase: "strike", phaseElapsedSeconds: 0.08 },
        });
        const asset = library.instantiate(config.appearanceId, config.tier, "hero");
        const avatar = new ProceduralCharacterAvatar(asset, resolveCharacterRig(config), config);
        try {
          const rig = applyCharacterRigLimbLengths(resolveCharacterRig(config), avatar.measureActiveLimbLengths());
          for (const [pose, expected] of Object.entries(TRUNK_POSES)) {
            const [animationMode, seconds, variant] = pose.split("-");
            const posed = { ...config, animationMode: animationMode as "idle" | "walk" | "run" };
            const action = variant === "melee" ? strike : undefined;
            const actual = readTrunk(
              resolveProceduralCharacterPose(rig, posed, Number(seconds), undefined, undefined, action),
            );
            actual.forEach((value, index) =>
              expect(value, `${pose} component ${index}`).toBeCloseTo(expected[index], 5),
            );
          }
        } finally {
          avatar.dispose();
        }
      },
    );
  }, 60_000);
});
