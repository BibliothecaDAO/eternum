// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createKnightGuardSubject,
  sampleAttackCycle,
  sampleLocomotionGuard,
  summariseWorstGuardClearance,
  type KnightGuardSample,
} from "../../../test-support/knight-guard-clearance";
import { withKnightLibrary } from "../../../test-support/with-knight-library";

/** The Knight's stature, from runtime-fit.json (body.stature). */
const STATURE = 0.61526;
const MIN_BLADE_TO_SHIELD = 0.01;
const MIN_ARM_TO_SHIELD = 0.005;
const MIN_BLADE_TIP_HEIGHT = 0.01;
const MIN_SHIELD_TURN_LEFT_DEGREES = 30;
const MAX_SHIELD_TURN_LEFT_DEGREES = 50;
const MAX_SHIELD_UPRIGHT_DEGREES = 15;
const MAX_SHIELD_RIGHTMOST_FROM_MIDLINE = 0.01;
const MAX_BLADE_FROM_VERTICAL_DEGREES = 40;
const MAX_HINGE_AXIS_DEGREES = 2;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Expects every sample to satisfy the check, and says the worst of every criterion of the motion when one does not. */
function expectEverySample(
  samples: readonly KnightGuardSample[],
  criterion: string,
  holds: (sample: KnightGuardSample) => boolean,
) {
  const failing = samples.filter((sample) => !holds(sample)).map(({ label }) => label);
  expect(failing, `${criterion}. Worst of the motion: ${summariseWorstGuardClearance(samples)}`).toEqual([]);
}

function expectNoTouching(samples: readonly KnightGuardSample[]) {
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
    "blade clear of the head, trunk, thighs and shins, and of the floor",
    ({ clearance }) =>
      clearance.bladeToHead > 0 &&
      clearance.bladeToTrunk > 0 &&
      clearance.bladeToLegs > 0 &&
      clearance.bladeTipHeight >= MIN_BLADE_TIP_HEIGHT,
  );
  expectEverySample(
    samples,
    "hinge axes of both arms agree",
    ({ clearance }) => clearance.hingeAxisDegrees < MAX_HINGE_AXIS_DEGREES,
  );
}

function expectGuard(samples: readonly KnightGuardSample[]) {
  expectEverySample(
    samples,
    "shield clear of the head, trunk, thighs and shins",
    ({ clearance }) => clearance.shieldToHead > 0 && clearance.shieldToTrunk > 0 && clearance.shieldToLegs > 0,
  );
  expectEverySample(
    samples,
    "shield faces 30 to 50 degrees left of forward, upright within 15",
    ({ clearance }) =>
      clearance.shieldTurnLeftDegrees >= MIN_SHIELD_TURN_LEFT_DEGREES &&
      clearance.shieldTurnLeftDegrees <= MAX_SHIELD_TURN_LEFT_DEGREES &&
      clearance.shieldUprightDegrees <= MAX_SHIELD_UPRIGHT_DEGREES,
  );
  expectEverySample(
    samples,
    "shield's rightmost point at or left of the midline, top rim below the eyes, forearm behind it",
    ({ clearance }) =>
      clearance.shieldRightmostFromMidline <= MAX_SHIELD_RIGHTMOST_FROM_MIDLINE &&
      clearance.shieldTopBelowEyes > 0 &&
      clearance.forearmInFrontOfShield < 0,
  );
  expectEverySample(
    samples,
    "blade within 40 degrees of vertical and not leaning inward",
    ({ clearance }) =>
      clearance.bladeVerticalDegrees <= MAX_BLADE_FROM_VERTICAL_DEGREES && clearance.bladeLeanInward <= 0,
  );
}

describe("T1 Knight sword and shield under the procedural pose controller", () => {
  for (const renderDetail of ["hero", "crowd"] as const) {
    it(`keeps the guard half open and the sword clear of the shield on the ${renderDetail} skeleton`, async () => {
      await withKnightLibrary((library) => {
        const subject = createKnightGuardSubject(library, renderDetail, STATURE);
        try {
          for (const motion of ["idle", "walk", "run"] as const) {
            const samples = sampleLocomotionGuard(subject, motion);
            expectNoTouching(samples);
            expectGuard(samples);
          }
          expectNoTouching(sampleAttackCycle(subject));
        } finally {
          subject.avatar.dispose();
        }
      });
    });
  }
});
