import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  applyProceduralCharacterConfigPatch,
  createDefaultProceduralCharacterConfig,
} from "../procedural-character-config";
import { isProceduralCharacterPoseFinite, resolveProceduralCharacterPose } from "../procedural-character-pose";
import { resolveCharacterRig } from "../procedural-character-rig";
import type { ProceduralMeleeAttackState } from "./procedural-melee-attack-cycle";
import { createDefaultProceduralMeleeConfig } from "./procedural-melee-config";
import { resolveProceduralMeleeUpperBodyPose } from "./procedural-melee-pose";

describe("procedural melee pose", () => {
  it("moves the weapon hand through a readable slash arc while keeping the pose finite", () => {
    const characterConfig = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(characterConfig);
    const windup = resolveProceduralCharacterPose(
      rig,
      characterConfig,
      0,
      undefined,
      undefined,
      createMeleeAction("windup", 1, "slash", false),
    );
    const contact = resolveProceduralCharacterPose(
      rig,
      characterConfig,
      0,
      undefined,
      undefined,
      createMeleeAction("contact", 0, "slash", false),
    );

    expect(isProceduralCharacterPoseFinite(windup)).toBe(true);
    expect(isProceduralCharacterPoseFinite(contact)).toBe(true);
    expect(
      resolveSegmentEndpoint(windup, "forearmRight").distanceTo(resolveSegmentEndpoint(contact, "forearmRight")),
    ).toBeGreaterThan(0.35);
    expect(resolveRightElbowDegrees(windup)).toBeGreaterThan(25);
  });

  it("drives a mounted chopping weapon down through contact without changing the seated leg solution", () => {
    const characterConfig = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      animationMode: "mounted",
    });
    const rig = resolveCharacterRig(characterConfig);
    const windup = resolveProceduralCharacterPose(
      rig,
      characterConfig,
      0.2,
      undefined,
      undefined,
      createMeleeAction("windup", 1, "chop", true),
    );
    const contact = resolveProceduralCharacterPose(
      rig,
      characterConfig,
      0.2,
      undefined,
      undefined,
      createMeleeAction("contact", 0, "chop", true),
    );

    expect(isProceduralCharacterPoseFinite(contact)).toBe(true);
    expect(
      horizontalDistance(resolveSegmentEndpoint(windup, "forearmRight"), new Vector3(...windup.parts.head.position)),
    ).toBeGreaterThan(0.24);
    expect(resolveSegmentEndpoint(contact, "forearmRight").y).toBeLessThan(
      resolveSegmentEndpoint(windup, "forearmRight").y - 0.25,
    );
    expect(contact.parts.shinLeft.jointAnchor).toEqual(windup.parts.shinLeft.jointAnchor);
    expect(contact.parts.shinRight.jointAnchor).toEqual(windup.parts.shinRight.jointAnchor);
  });

  it.each(["chop", "smash"] as const)("keeps an unmounted %s windup outside the head silhouette", (attackStyle) => {
    const characterConfig = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(characterConfig);
    const windup = resolveProceduralCharacterPose(
      rig,
      characterConfig,
      0,
      undefined,
      undefined,
      createMeleeAction("windup", 1, attackStyle, false),
    );

    expect(
      horizontalDistance(resolveSegmentEndpoint(windup, "forearmRight"), new Vector3(...windup.parts.head.position)),
    ).toBeGreaterThan(0.24);
  });
});

function createMeleeAction(
  phase: ProceduralMeleeAttackState["phase"],
  phaseProgress: number,
  attackStyle: "chop" | "slash" | "smash",
  mounted: boolean,
) {
  const config = createDefaultProceduralMeleeConfig();
  const phaseDuration =
    phase === "windup" ? config.windupSeconds : phase === "contact" ? config.contactSeconds : config.strikeSeconds;
  return resolveProceduralMeleeUpperBodyPose({
    aimPitchRadians: mounted ? -0.22 : 0,
    aimYawRadians: 0,
    attackStyle,
    config,
    mounted,
    state: {
      attackGeneration: 1,
      contactCount: phase === "contact" ? 1 : 0,
      phase,
      phaseElapsedSeconds: phaseDuration * phaseProgress,
    },
  });
}

function resolveSegmentEndpoint(
  pose: ReturnType<typeof resolveProceduralCharacterPose>,
  partId: "forearmRight",
): Vector3 {
  const part = pose.parts[partId];
  return new Vector3(...part.position).multiplyScalar(2).sub(new Vector3(...part.jointAnchor));
}

function resolveRightElbowDegrees(pose: ReturnType<typeof resolveProceduralCharacterPose>): number {
  const shoulder = new Vector3(...pose.parts.upperArmRight.jointAnchor);
  const elbow = new Vector3(...pose.parts.forearmRight.jointAnchor);
  const wrist = resolveSegmentEndpoint(pose, "forearmRight");
  const toShoulder = shoulder.sub(elbow).normalize();
  const toWrist = wrist.sub(elbow).normalize();
  return (Math.acos(Math.min(1, Math.max(-1, toShoulder.dot(toWrist)))) * 180) / Math.PI;
}

function horizontalDistance(first: Vector3, second: Vector3): number {
  first.y = 0;
  second.y = 0;
  return first.distanceTo(second);
}
