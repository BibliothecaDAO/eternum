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
import {
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeOffhandId,
  type ProceduralMeleeWeaponId,
} from "./procedural-melee-weapon-catalog";

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

  it("resolves how the offhand is carried once, from the catalog", () => {
    const carryOf = (offhandId: ProceduralMeleeOffhandId) =>
      resolveProceduralMeleeUpperBodyPose({
        aimPitchRadians: 0,
        aimYawRadians: 0,
        attackStyle: "slash",
        config: { ...createDefaultProceduralMeleeConfig(), offhandId },
        holds: { guard: 0, move: 0, run: 0 },
        seed: 0,
        mounted: false,
        state: { attackGeneration: 0, contactCount: 0, phase: "idle", phaseElapsedSeconds: 0 },
      }).offhandCarry;

    expect(carryOf("none")).toBe("none");
    expect(carryOf("round-shield")).toBe("gripped");
    expect(carryOf("t1-knight-default-shield")).toBe("strapped");
  });

  it("holds gear that declares states at the seed's idle, and at guard when told to hold it, and only that gear", () => {
    const stateOf = (weaponId: ProceduralMeleeWeaponId, offhandId: ProceduralMeleeOffhandId, guard = 0, seed = 0) =>
      resolveProceduralMeleeUpperBodyPose({
        aimPitchRadians: 0,
        aimYawRadians: 0,
        attackStyle: "slash",
        config: { ...createDefaultProceduralMeleeConfig(), offhandId, weaponId },
        holds: { guard, move: 0, run: 0 },
        mounted: false,
        seed,
        state: { attackGeneration: 0, contactCount: 0, phase: "idle", phaseElapsedSeconds: 0 },
      });
    const sword = resolveProceduralMeleeWeapon("t1-knight-default-sword");
    const shield = resolveProceduralMeleeOffhand("t1-knight-default-shield").armPoses;
    if (!sword.armPoses || !sword.bodyPoses || !shield) throw new Error("The Knight's gear declares no states");
    const flatten = (pose?: { elbow: readonly number[]; handTurn: readonly number[]; wrist: readonly number[] }) => [
      ...(pose?.elbow ?? []),
      ...(pose?.handTurn ?? []),
      ...(pose?.wrist ?? []),
    ];
    const expectPose = (actual: readonly number[], expected: readonly number[]) => {
      expect(actual).toHaveLength(10);
      actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 5));
    };

    for (const seed of [0, 1, 2, 5]) {
      const idle = stateOf("t1-knight-default-sword", "t1-knight-default-shield", 0, seed);
      expectPose(flatten(idle.arms.left), flatten(shield.idle[seed % shield.idle.length]));
      expectPose(flatten(idle.arms.right), flatten(sword.armPoses.idle[seed % sword.armPoses.idle.length]));
      expect(idle.body?.pelvis.yaw).toBeCloseTo(sword.bodyPoses.idle[seed % sword.bodyPoses.idle.length].pelvis.yaw, 6);
      expect(idle.body?.footLift).toEqual({ left: 0, right: 0 });
    }
    const held = stateOf("t1-knight-default-sword", "t1-knight-default-shield", 1);
    expectPose(flatten(held.arms.left), flatten(shield.guard));
    expectPose(flatten(held.arms.right), flatten(sword.armPoses.guard));
    expect(held.body?.stance.left.forward).toBeCloseTo(sword.bodyPoses.guard.stance.left.forward, 6);
    const plain = stateOf("iron-longsword", "round-shield", 1);
    expect(plain.arms).toEqual({});
    expect(plain.body).toBeUndefined();
    expect(plain.hit).toBeUndefined();
  });

  it("lifts the foot a state moves forward while it steps there, and puts it down at either end", () => {
    const sword = resolveProceduralMeleeWeapon("t1-knight-default-sword").bodyPoses;
    if (!sword) throw new Error("The Knight's sword declares no body states");
    const liftAt = (guard: number) =>
      resolveProceduralMeleeUpperBodyPose({
        aimPitchRadians: 0,
        aimYawRadians: 0,
        attackStyle: "slash",
        config: {
          ...createDefaultProceduralMeleeConfig(),
          offhandId: "t1-knight-default-shield",
          weaponId: "t1-knight-default-sword",
        },
        holds: { guard, move: 0, run: 0 },
        mounted: false,
        seed: 0,
        state: { attackGeneration: 0, contactCount: 0, phase: "idle", phaseElapsedSeconds: 0 },
      }).body?.footLift;

    // Into guard the left foot steps forward and the right one draws back.
    expect(sword.guard.stance.left.forward).toBeGreaterThan(sword.idle[0].stance.left.forward + 0.05);
    expect(liftAt(0.5)).toEqual({ left: 1, right: 0 });
    expect(liftAt(1)?.left).toBeCloseTo(0, 9);
    expect(liftAt(0)).toEqual({ left: 0, right: 0 });
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
    holds: { guard: 0, move: 0, run: 0 },
    seed: 0,
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
