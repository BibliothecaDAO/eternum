// @vitest-environment node
import { readFileSync } from "node:fs";

import { Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withKnightLibrary } from "../../../test-support/with-knight-library";
import { createIdleProceduralMeleeAttackState } from "./melee/procedural-melee-attack-cycle";
import { applyProceduralMeleeConfigPatch, createDefaultProceduralMeleeConfig } from "./melee/procedural-melee-config";
import { resolveProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import { PROCEDURAL_MELEE_OFFHANDS } from "./melee/procedural-melee-weapon-catalog";
import { ProceduralCharacterAvatar } from "./procedural-character-avatar";
import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";

const RUNTIME_FIT = JSON.parse(readFileSync("asset-sources/characters/t1-knight-default/runtime-fit.json", "utf8")) as {
  body: { stature: number };
  joints: { name: string; rest_position: [number, number, number] }[];
};
/** Fraction of the stature at which the Knight's eyes sit. */
const EYE_HEIGHT_RATIO = 0.92;
const MAX_SHIELD_YAW_FROM_FORWARD_DEGREES = 25;
const MAX_HINGE_AXIS_DIFFERENCE_DEGREES = 2;
const FRAMES_PER_SECOND = 60;
/** 0.1 s, 0.35 s and 0.6 s into each motion. */
const MEASURED_FRAMES = [6, 21, 36];
const FORWARD = new Vector3(0, 0, 1);
const SHIELD_RADIUS =
  (PROCEDURAL_MELEE_OFFHANDS.find(({ id }) => id === "t1-knight-default-shield")?.visualDiameter ?? 0) / 2;

function restPosition(name: string): Vector3 {
  const joint = RUNTIME_FIT.joints.find((candidate) => candidate.name === name);
  if (!joint) throw new Error(`runtime-fit.json has no joint ${name}`);
  return new Vector3(...joint.rest_position);
}

/** The normal of the plane through shoulder, elbow and wrist, the same way the runtime defines it: forearm x upper arm. */
function restHingeAxis(side: "l" | "r"): Vector3 {
  const shoulder = restPosition(`upperarm_${side}`);
  const elbow = restPosition(`lowerarm_${side}`);
  const wrist = restPosition(`hand_${side}`);
  return wrist.sub(elbow).cross(elbow.sub(shoulder)).normalize();
}

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("T1 Knight arms under the procedural pose controller", () => {
  for (const renderDetail of ["hero", "crowd"] as const) {
    it(`carries the strapped shield facing forward on the ${renderDetail} skeleton, with hinge arms`, async () => {
      await withKnightLibrary((library) => {
        const config = {
          ...createDefaultProceduralCharacterConfig(),
          appearanceId: "t1-knight-default" as const,
          renderDetail,
          tier: 1 as const,
        };
        const asset = library.instantiate(config.appearanceId, config.tier, renderDetail);
        const avatar = new ProceduralCharacterAvatar(asset, resolveCharacterRig(config), config);
        const rig = applyCharacterRigLimbLengths(resolveCharacterRig(config), avatar.measureActiveLimbLengths());
        avatar.rebuild(rig, config);
        const guard = resolveProceduralMeleeUpperBodyPose({
          aimPitchRadians: 0,
          aimYawRadians: 0,
          attackStyle: "slash",
          config: applyProceduralMeleeConfigPatch(createDefaultProceduralMeleeConfig("knight"), {
            offhandId: "t1-knight-default-shield",
            weaponId: "t1-knight-default-sword",
          }),
          mounted: false,
          state: createIdleProceduralMeleeAttackState(),
        });
        const eyeHeight = RUNTIME_FIT.body.stature * EYE_HEIGHT_RATIO;
        const shieldPosition = new Vector3();
        const shieldRotation = new Quaternion();
        try {
          for (const animationMode of ["idle", "walk", "run"] as const) {
            const posed = { ...config, animationMode };
            avatar.updateConfig(posed);
            // Frame by frame, as the runtime does: the arm solver keeps the bend plane of the frame before.
            for (let frame = 0; frame <= MEASURED_FRAMES.at(-1)!; frame++) {
              const elapsedSeconds = frame / FRAMES_PER_SECOND;
              avatar.applyPose(resolveProceduralCharacterPose(rig, posed, elapsedSeconds, undefined, undefined, guard));
              if (!MEASURED_FRAMES.includes(frame)) continue;
              const label = `${animationMode} ${elapsedSeconds.toFixed(2)}s`;
              expect(avatar.writeSocketWorldTransform("forearmLeft", shieldPosition, shieldRotation)).toBe(true);
              const shieldFront = FORWARD.clone().applyQuaternion(shieldRotation);

              expect(
                degrees(shieldFront.angleTo(FORWARD)),
                `${label}: shield front ${shieldFront.toArray().map((v) => v.toFixed(2))} from forward`,
              ).toBeLessThan(MAX_SHIELD_YAW_FROM_FORWARD_DEGREES);

              const joints = avatar.readWorldDiagnosticJoints();
              for (const joint of ["elbowLeft", "wristLeft"] as const) {
                const behindRear = new Vector3(...joints[joint]).sub(shieldPosition).dot(shieldFront);
                expect(behindRear, `${label}: ${joint} is on the body's side of the shield's rear`).toBeLessThan(0);
              }

              const topRim = shieldPosition.y + SHIELD_RADIUS * Math.sqrt(1 - shieldFront.y ** 2);
              expect(topRim, `${label}: shield top rim below the eyes`).toBeLessThan(eyeHeight);
              const midline = (joints.shoulderLeft[0] + joints.shoulderRight[0]) / 2;
              expect(shieldPosition.x, `${label}: shield centre left of the midline`).toBeGreaterThan(midline);

              for (const side of ["l", "r"] as const) {
                const axes = ["upperarm", "lowerarm"].map((bone) =>
                  restHingeAxis(side).applyQuaternion(
                    asset.gltf.scene.getObjectByName(`${bone}_${side}`)!.getWorldQuaternion(new Quaternion()),
                  ),
                );
                expect(
                  degrees(axes[0].angleTo(axes[1])),
                  `${label}: ${side} upper arm and forearm hinge axes`,
                ).toBeLessThan(MAX_HINGE_AXIS_DIFFERENCE_DEGREES);
              }
            }
          }
        } finally {
          avatar.dispose();
        }
      });
    });
  }
});
