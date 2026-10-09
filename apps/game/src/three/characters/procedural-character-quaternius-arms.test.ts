// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { withCharacterLibrary } from "../../../test-support/with-character-library";
import { createIdleProceduralMeleeAttackState } from "./melee/procedural-melee-attack-cycle";
import { createDefaultProceduralMeleeConfig } from "./melee/procedural-melee-config";
import { resolveProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import { ProceduralCharacterAvatar } from "./procedural-character-avatar";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";
import { loadQuaterniusCharacterAssetTemplates } from "./quaternius-character-assets";

const ARM_BONES = ["upperarm_l", "lowerarm_l", "upperarm_r", "lowerarm_r"] as const;

/**
 * Local rotations (x, y, z, w per bone, in ARM_BONES order) of the Quaternius arms: a rig that asks for no hinge arms
 * and wears no gear with arm poses is posed by the shortest arc, to these values. A pose is
 * `<mode>-<seconds>-<base|melee>`.
 */
const SHORTEST_ARC_ARM_ROTATIONS: Readonly<Record<string, readonly number[]>> = {
  "idle-0.1-base": [
    -0.204525, 0.691624, -0.565598, 0.399906, -0.15492, -0.963551, -0.076036, -0.204421, -0.206322, -0.690855, 0.564718,
    0.401552, 0.155119, -0.96417, -0.075629, 0.201481,
  ],
  "idle-0.1-melee": [
    -0.022708, 0.533561, -0.014041, 0.84534, 0.728411, 0.562194, 0.280612, 0.273153, 0.572904, -0.701869, 0.078489,
    0.415933, -0.191731, -0.324472, -0.915525, 0.140613,
  ],
  "walk-0.35-base": [
    -0.521853, 0.314353, -0.169122, 0.774757, 0.134645, 0.783695, -0.107946, -0.596692, 0.356426, -0.745553, 0.562059,
    -0.034653, 0.051181, -0.590479, -0.16481, 0.788386,
  ],
  "walk-0.35-melee": [
    -0.002723, 0.507267, 0.033942, 0.861116, 0.764421, 0.554028, 0.200297, 0.261907, 0.58109, -0.682697, 0.071918,
    0.437135, -0.20006, -0.313731, -0.917604, 0.139827,
  ],
  "run-0.35-base": [
    0.274546, 0.767294, -0.57274, 0.088621, 0.097618, 0.618939, 0.142311, 0.766246, 0.433796, -0.715332, 0.547232,
    -0.025671, 0.045922, -0.534525, -0.166352, 0.827346,
  ],
  "run-0.6-melee": [
    -0.060906, 0.459789, -0.069395, 0.883215, 0.730056, 0.554625, 0.300506, 0.262879, 0.527935, -0.700396, 0.027723,
    0.479543, -0.347987, -0.233764, -0.904595, 0.077246,
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Quaternius arms", () => {
  it("keep their shortest-arc rotations: the rig asks for no hinge arms and its gear declares no arm poses", async () => {
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
        for (const [pose, expected] of Object.entries(SHORTEST_ARC_ARM_ROTATIONS)) {
          // A fresh figure per pose: the solver keeps the bend plane of the pose before.
          const asset = library.instantiate(config.appearanceId, config.tier, "hero");
          const avatar = new ProceduralCharacterAvatar(asset, resolveCharacterRig(config), config);
          try {
            const rig = applyCharacterRigLimbLengths(resolveCharacterRig(config), avatar.measureActiveLimbLengths());
            avatar.rebuild(rig, config);
            const [animationMode, seconds, variant] = pose.split("-");
            const posed = { ...config, animationMode: animationMode as "idle" | "walk" | "run" };
            avatar.updateConfig(posed);
            const action = variant === "melee" ? strike : undefined;
            avatar.applyPose(resolveProceduralCharacterPose(rig, posed, Number(seconds), undefined, undefined, action));
            const actual = ARM_BONES.flatMap((name) => asset.gltf.scene.getObjectByName(name)!.quaternion.toArray());
            actual.forEach((value, index) =>
              expect(value, `${pose} component ${index}`).toBeCloseTo(expected[index], 5),
            );
          } finally {
            avatar.dispose();
          }
        }
      },
    );
  }, 60_000);
});
