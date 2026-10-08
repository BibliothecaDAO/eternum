// @vitest-environment node
import { readFileSync } from "node:fs";

import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ATTACK_SAMPLE_COUNT,
  createKnightGuardSubject,
  measureKnightArmState,
  sampleAttackCycle,
  sampleLocomotionGuard,
  summariseWorstGuardClearance,
  type KnightGuardSample,
} from "../../../test-support/knight-guard-clearance";
import { withKnightLibrary } from "../../../test-support/with-knight-library";
import {
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeArmPose,
  type ProceduralMeleeArmPoseState,
} from "./melee/procedural-melee-weapon-catalog";

/** The Knight's stature, from runtime-fit.json (body.stature). */
const STATURE = 0.61526;
const MIN_BLADE_TO_SHIELD = 0.01;
const MIN_ARM_TO_SHIELD = 0.005;
const MIN_SHIELD_TO_LEGS = 0.005;
const MIN_BLADE_TIP_HEIGHT = 0.01;
const MAX_HINGE_AXIS_DEGREES = 2;
const MAX_STATE_POSITION_ERROR = 0.008;
const MAX_STATE_DIRECTION_ERROR_DEGREES = 5;
const STATES: readonly ProceduralMeleeArmPoseState[] = ["carry", "guard", "windup", "contact", "follow"];

interface ArmPoseFile {
  states: Record<
    ProceduralMeleeArmPoseState,
    {
      expect: Record<string, readonly number[]>;
      left: { elbow: number[]; hand_turn_xyzw: number[]; wrist: number[] };
      right: { elbow: number[]; hand_turn_xyzw: number[]; wrist: number[] };
    }
  >;
}
const ARM_POSES = JSON.parse(
  readFileSync("asset-sources/characters/t1-knight-default/arm-poses.json", "utf8"),
) as ArmPoseFile;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Expects every sample to satisfy the check, and says the worst of every criterion of the motion when one does not. */
function expectEverySample(
  samples: readonly KnightGuardSample[],
  criterion: string,
  holds: (sample: KnightGuardSample) => boolean,
) {
  const failing = samples.filter((sample) => !holds(sample)).map(({ label }) => label);
  expect(failing, `${criterion}. Worst of the motion: ${summariseWorstGuardClearance(samples)}`).toEqual([]);
}

function expectNothingTouches(samples: readonly KnightGuardSample[]) {
  expectEverySample(
    samples,
    "blade 1 cm from the shield",
    ({ clearance }) => clearance.bladeToShield >= MIN_BLADE_TO_SHIELD,
  );
  expectEverySample(
    samples,
    "sword arm 5 mm from the shield",
    ({ clearance }) => clearance.armToShield >= MIN_ARM_TO_SHIELD,
  );
  expectEverySample(
    samples,
    "blade clear of the head, trunk, thighs, shins and the shield arm, and 1 cm above the floor",
    ({ clearance }) =>
      clearance.bladeToHead > 0 &&
      clearance.bladeToTrunk > 0 &&
      clearance.bladeToLegs > 0 &&
      clearance.bladeToShieldArm > 0 &&
      clearance.bladeTipHeight >= MIN_BLADE_TIP_HEIGHT,
  );
  expectEverySample(
    samples,
    "hinge axes of both arms agree",
    ({ clearance }) => clearance.hingeAxisDegrees < MAX_HINGE_AXIS_DEGREES,
  );
}

describe("T1 Knight arm poses", () => {
  it("are the numbers of arm-poses.json, written in the catalog", () => {
    const shield = resolveProceduralMeleeOffhand("t1-knight-default-shield").armPoses;
    const sword = resolveProceduralMeleeWeapon("t1-knight-default-sword").armPoses;
    const declared = (
      pose: ProceduralMeleeArmPose | undefined,
      file: ArmPoseFile["states"][ProceduralMeleeArmPoseState]["left"],
    ) =>
      expect({ elbow: pose?.elbow, handTurn: pose?.handTurn, wrist: pose?.wrist }).toEqual({
        elbow: file.elbow,
        handTurn: file.hand_turn_xyzw,
        wrist: file.wrist,
      });

    for (const state of STATES) {
      declared(sword?.[state], ARM_POSES.states[state].right);
      if (state === "carry" || state === "guard") declared(shield?.[state], ARM_POSES.states[state].left);
    }
    expect(Object.keys(shield ?? {}).sort()).toEqual(["carry", "guard"]);
  });

  for (const renderDetail of ["hero", "crowd"] as const) {
    it(`puts the arms, shield and sword where the approved poses put them on the ${renderDetail} skeleton`, async () => {
      await withKnightLibrary((library) => {
        const subject = createKnightGuardSubject(library, renderDetail, STATURE);
        try {
          for (const state of STATES) {
            const measured = measureKnightArmState(subject, state);
            const expected = ARM_POSES.states[state].expect;
            const point = (name: string) => new Vector3(...expected[name]);
            const positions: [string, Vector3][] = [
              ["left_elbow", measured.leftElbow],
              ["left_wrist", measured.leftWrist],
              ["right_elbow", measured.rightElbow],
              ["right_wrist", measured.rightWrist],
              ["shield_centre", measured.shieldCentre],
              ["sword_grip", measured.swordGrip],
            ];
            const directions: [string, Vector3][] = [
              ["shield_front", measured.shieldFront],
              ["blade", measured.blade],
            ];
            const report = [
              ...positions.map(([name, value]) => `${name} ${(value.distanceTo(point(name)) * 1000).toFixed(1)}mm`),
              ...directions.map(([name, value]) => `${name} ${degrees(value.angleTo(point(name))).toFixed(1)}deg`),
            ].join(", ");
            for (const [name, value] of positions) {
              expect(value.distanceTo(point(name)), `${state}: ${report}`).toBeLessThan(MAX_STATE_POSITION_ERROR);
            }
            for (const [name, value] of directions) {
              expect(degrees(value.angleTo(point(name))), `${state}: ${report}`).toBeLessThan(
                MAX_STATE_DIRECTION_ERROR_DEGREES,
              );
            }
          }
        } finally {
          subject.avatar.dispose();
        }
      });
    });

    it(`keeps sword and shield clear of each other and of the body through every motion on the ${renderDetail} skeleton`, async () => {
      await withKnightLibrary((library) => {
        const subject = createKnightGuardSubject(library, renderDetail, STATURE);
        try {
          // One figure goes through the motions in turn, as in play: an elbow left on the far side of its pole by one
          // motion would put the blade through the shield in the next.
          for (const motion of ["idle", "walk", "run"] as const) {
            const samples = sampleLocomotionGuard(subject, motion);
            expectNothingTouches(samples);
            expectEverySample(
              samples,
              "shield clear of the head and trunk",
              ({ clearance }) => clearance.shieldToHead > 0 && clearance.shieldToTrunk > 0,
            );
            // On the move the arms hold guard: carry holds the shield low enough for a rising knee to reach it.
            expectEverySample(
              samples,
              "shield 5 mm from the thighs and shins",
              ({ clearance }) => clearance.shieldToLegs >= MIN_SHIELD_TO_LEGS,
            );
          }
          const attack = sampleAttackCycle(subject);
          expect(attack).toHaveLength(ATTACK_SAMPLE_COUNT);
          expectNothingTouches(attack);
        } finally {
          subject.avatar.dispose();
        }
      });
    });
  }
});
