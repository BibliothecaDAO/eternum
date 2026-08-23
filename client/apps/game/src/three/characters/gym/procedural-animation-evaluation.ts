import { resolveQuaternionAngularDistanceDegrees } from "../procedural-character-diagnostics";
import type { ProceduralAnimationCaptureResult, ProceduralAnimationFrameCapture } from "./procedural-animation-capture";

const MAX_FOOT_ANGULAR_STEP_DEGREES = 20;
const MAX_FOOT_ANGULAR_TRAVEL_DEGREES = 180;
const MAX_RUN_STANCE_FOOT_STEP_DEGREES = 12;
const MAX_WALK_STANCE_FOOT_STEP_DEGREES = 6;

export interface ProceduralAnimationObjectiveEvaluation {
  blankViewCount: number;
  automatedHardGatePassed: boolean;
  issueCount: number;
  issueFrameCount: number;
  locomotionHardGateFailures: readonly string[];
  locomotionHardGatePassed: boolean | null;
  measurements: {
    elbowDegrees: { maximum: number | null; minimum: number | null };
    kneeDegrees: { maximum: number | null; minimum: number | null };
    maximumJointStep: number | null;
    maximumFootAngularStepDegrees: number | null;
    maximumStableStanceFootAngularStepDegrees: number | null;
    maximumSocketDivergence: number | null;
    maximumStanceContactDrift: number | null;
    locomotion: ProceduralLocomotionEvaluation | null;
    minimumArrowHeadClearance: number | null;
    minimumHorseBendAlignment: number | null;
    minimumWeaponHeadClearance: number | null;
  };
  temporalCoverage: boolean;
}

interface ProceduralLocomotionEvaluation {
  capturedCycleCount: number;
  contactFraction: Readonly<Record<"left" | "right", number>>;
  doubleSupportFraction: number;
  flightFraction: number;
  footAngularStepPeak: ProceduralFootAngularStepEvent | null;
  footAngularTravelDegrees: Readonly<Record<"left" | "right", number | null>>;
  headToPelvisVerticalExcursionRatio: number | null;
  headVerticalExcursion: number;
  maximumStableStanceDrift: number | null;
  maximumFootAngularStepDegrees: number | null;
  maximumStableStanceFootAngularStepDegrees: number | null;
  pelvisLateralExcursion: number;
  pelvisVerticalExcursion: number;
  rootTravelDistance: number;
  swingApexProgress: Readonly<Record<"left" | "right", number | null>>;
  swingClearance: Readonly<Record<"left" | "right", number | null>>;
  swingClearanceAsymmetry: number | null;
  stableStanceFootAngularStepPeak: ProceduralFootAngularStepEvent | null;
}

interface ProceduralFootAngularStepEvent {
  angleDegrees: number;
  contact: "stance" | "swing";
  frameIndex: number;
  progress: number;
  side: "left" | "right";
}

export function evaluateProceduralAnimationCapture(
  result: Pick<ProceduralAnimationCaptureResult, "frames" | "plan">,
): ProceduralAnimationObjectiveEvaluation {
  const blankViewCount = result.frames
    .flatMap(({ views }) => views)
    .filter(({ imageNonBlank }) => !imageNonBlank).length;
  const issueCount = result.frames.reduce((count, frame) => count + frame.issues.length, 0);
  const temporalCoverage = result.plan.sampling === "all-frames";
  const maximumStanceContactDrift = temporalCoverage ? maximum(resolveStanceContactDrifts(result.frames)) : null;
  const locomotion =
    temporalCoverage && result.plan.sequence === "locomotion-cycle" ? evaluateLocomotion(result.frames) : null;
  const locomotionHardGateFailures = locomotion
    ? resolveLocomotionHardGateFailures(locomotion, maximumStanceContactDrift, result.plan.rootMotionSpeed)
    : [];
  const locomotionHardGatePassed = locomotion ? locomotionHardGateFailures.length === 0 : null;
  return {
    blankViewCount,
    automatedHardGatePassed: blankViewCount === 0 && issueCount === 0 && locomotionHardGatePassed !== false,
    issueCount,
    issueFrameCount: result.frames.filter(({ issues }) => issues.length > 0).length,
    locomotionHardGateFailures,
    locomotionHardGatePassed,
    measurements: {
      elbowDegrees: range(
        resolveHumanoidValues(result.frames, ({ arms }) => [arms.left.elbowDegrees, arms.right.elbowDegrees]),
      ),
      kneeDegrees: range(
        resolveHumanoidValues(result.frames, ({ legs }) => [legs.left.kneeDegrees, legs.right.kneeDegrees]),
      ),
      maximumJointStep: temporalCoverage ? maximum(resolveConsecutiveJointSteps(result.frames)) : null,
      maximumFootAngularStepDegrees: temporalCoverage
        ? maximum(resolveConsecutiveFootAngularSteps(result.frames))
        : null,
      maximumStableStanceFootAngularStepDegrees: temporalCoverage
        ? maximum(resolveConsecutiveFootAngularSteps(result.frames, true))
        : null,
      maximumSocketDivergence: maximum(
        resolveHumanoidValues(result.frames, ({ arms }) => [arms.left.solverSocketError, arms.right.solverSocketError]),
      ),
      maximumStanceContactDrift,
      locomotion,
      minimumArrowHeadClearance: minimum(
        result.frames.flatMap(({ diagnostics }) => (diagnostics.bow ? [diagnostics.bow.arrowHeadClearance] : [])),
      ),
      minimumHorseBendAlignment: minimum(
        result.frames.flatMap(({ diagnostics }) =>
          diagnostics.horse ? Object.values(diagnostics.horse.legs).map(({ bendAlignment }) => bendAlignment) : [],
        ),
      ),
      minimumWeaponHeadClearance: minimum(
        result.frames.flatMap(({ diagnostics }) =>
          diagnostics.melee?.weaponHeadClearance === null || !diagnostics.melee
            ? []
            : [diagnostics.melee.weaponHeadClearance],
        ),
      ),
    },
    temporalCoverage,
  };
}

function resolveLocomotionHardGateFailures(
  locomotion: ProceduralLocomotionEvaluation,
  maximumStanceContactDrift: number | null,
  rootMotionSpeed: number,
): string[] {
  const failures: string[] = [];
  const walking = (locomotion.contactFraction.left + locomotion.contactFraction.right) * 0.5 > 0.5;
  if (rootMotionSpeed <= 0) failures.push("moving-root-capture-required");
  if (locomotion.capturedCycleCount < 0.9 || locomotion.capturedCycleCount > 1.1) {
    failures.push("incomplete-gait-cycle");
  }
  if (locomotion.rootTravelDistance <= 0.05) failures.push("insufficient-root-travel");
  if (maximumStanceContactDrift === null || maximumStanceContactDrift > 0.01) {
    failures.push("stance-contact-drift");
  }
  if (Math.abs(locomotion.contactFraction.left - locomotion.contactFraction.right) > 0.03) {
    failures.push("contact-duty-asymmetry");
  }
  if (locomotion.swingClearanceAsymmetry === null || locomotion.swingClearanceAsymmetry > 0.02) {
    failures.push("swing-clearance-asymmetry");
  }
  if (
    locomotion.maximumFootAngularStepDegrees === null ||
    locomotion.maximumFootAngularStepDegrees > MAX_FOOT_ANGULAR_STEP_DEGREES
  ) {
    failures.push("foot-angular-pop");
  }
  if (
    locomotion.maximumStableStanceFootAngularStepDegrees === null ||
    locomotion.maximumStableStanceFootAngularStepDegrees >
      (walking ? MAX_WALK_STANCE_FOOT_STEP_DEGREES : MAX_RUN_STANCE_FOOT_STEP_DEGREES)
  ) {
    failures.push("stance-foot-rotation");
  }
  if (
    Object.values(locomotion.footAngularTravelDegrees).some(
      (value) => value === null || value > MAX_FOOT_ANGULAR_TRAVEL_DEGREES,
    )
  ) {
    failures.push("foot-spin");
  }
  const apexProgress = Object.values(locomotion.swingApexProgress);
  if (apexProgress.some((value) => value === null || value < 0.3 || value > 0.55)) {
    failures.push("swing-apex-timing");
  }
  if (walking && (locomotion.doubleSupportFraction < 0.08 || locomotion.flightFraction > 0.02)) {
    failures.push("walk-support-pattern");
  }
  if (!walking && (locomotion.flightFraction < 0.05 || locomotion.doubleSupportFraction > 0.02)) {
    failures.push("run-support-pattern");
  }
  return failures;
}

type HumanoidCaptureFrame = ProceduralAnimationFrameCapture & {
  diagnostics: ProceduralAnimationFrameCapture["diagnostics"] & {
    humanoid: NonNullable<ProceduralAnimationFrameCapture["diagnostics"]["humanoid"]>;
  };
};

function evaluateLocomotion(frames: readonly ProceduralAnimationFrameCapture[]): ProceduralLocomotionEvaluation | null {
  const humanoidFrames = frames.filter((frame): frame is HumanoidCaptureFrame => Boolean(frame.diagnostics.humanoid));
  if (humanoidFrames.length < 2) return null;

  const frameCount = humanoidFrames.length;
  const supportCounts = humanoidFrames.map(
    ({ diagnostics }) => Object.values(diagnostics.humanoid.feet).filter(({ contact }) => contact === "stance").length,
  );
  const pelvisVerticalExcursion = pointAxisExcursion(humanoidFrames, "pelvis", 1);
  const headVerticalExcursion = pointAxisExcursion(humanoidFrames, "head", 1);
  const swingClearance = {
    left: resolveSwingClearance(humanoidFrames, "left"),
    right: resolveSwingClearance(humanoidFrames, "right"),
  } as const;
  const footAngularSteps = resolveFootAngularStepEvents(humanoidFrames);
  const stableStanceFootAngularSteps = resolveFootAngularStepEvents(humanoidFrames, true);
  return {
    capturedCycleCount: round(resolveCapturedCycles(humanoidFrames)),
    contactFraction: {
      left: round(resolveContactFraction(humanoidFrames, "left")),
      right: round(resolveContactFraction(humanoidFrames, "right")),
    },
    doubleSupportFraction: round(supportCounts.filter((count) => count === 2).length / frameCount),
    flightFraction: round(supportCounts.filter((count) => count === 0).length / frameCount),
    footAngularStepPeak: maximumFootAngularStepEvent(footAngularSteps),
    footAngularTravelDegrees: {
      left: resolveFootAngularTravel(humanoidFrames, "left"),
      right: resolveFootAngularTravel(humanoidFrames, "right"),
    },
    headToPelvisVerticalExcursionRatio:
      pelvisVerticalExcursion > 1e-6 ? round(headVerticalExcursion / pelvisVerticalExcursion) : null,
    headVerticalExcursion: round(headVerticalExcursion),
    maximumStableStanceDrift: maximum(resolveStanceContactDrifts(humanoidFrames, true)),
    maximumFootAngularStepDegrees: maximum(footAngularSteps.map(({ angleDegrees }) => angleDegrees)),
    maximumStableStanceFootAngularStepDegrees: maximum(
      stableStanceFootAngularSteps.map(({ angleDegrees }) => angleDegrees),
    ),
    pelvisLateralExcursion: round(pointAxisExcursion(humanoidFrames, "pelvis", 0, true)),
    pelvisVerticalExcursion: round(pelvisVerticalExcursion),
    rootTravelDistance: round(resolveRootTravelDistance(humanoidFrames)),
    swingApexProgress: {
      left: resolveSwingApexProgress(humanoidFrames, "left"),
      right: resolveSwingApexProgress(humanoidFrames, "right"),
    },
    swingClearance,
    swingClearanceAsymmetry:
      swingClearance.left === null || swingClearance.right === null
        ? null
        : round(Math.abs(swingClearance.left - swingClearance.right)),
    stableStanceFootAngularStepPeak: maximumFootAngularStepEvent(stableStanceFootAngularSteps),
  };
}

function resolveCapturedCycles(frames: readonly HumanoidCaptureFrame[]): number {
  return frames.slice(1).reduce((cycles, frame, index) => {
    const previousPhase = frames[index].diagnostics.humanoid.phase;
    const phase = frame.diagnostics.humanoid.phase;
    return cycles + ((phase - previousPhase + 1) % 1);
  }, 0);
}

function resolveContactFraction(frames: readonly HumanoidCaptureFrame[], side: "left" | "right"): number {
  return (
    frames.filter(({ diagnostics }) => diagnostics.humanoid.feet[side].contact === "stance").length / frames.length
  );
}

function resolveRootTravelDistance(frames: readonly HumanoidCaptureFrame[]): number {
  return frames
    .slice(1)
    .reduce(
      (distance, frame, index) =>
        distance +
        pointDistance(frame.diagnostics.humanoid.rootPosition, frames[index].diagnostics.humanoid.rootPosition),
      0,
    );
}

function pointAxisExcursion(
  frames: readonly HumanoidCaptureFrame[],
  joint: "head" | "pelvis",
  axis: 0 | 1 | 2,
  relativeToRoot = false,
): number {
  const values = frames.map(({ diagnostics }) => {
    const position = diagnostics.humanoid.joints[joint][axis];
    return relativeToRoot ? position - diagnostics.humanoid.rootPosition[axis] : position;
  });
  return Math.max(...values) - Math.min(...values);
}

function resolveSwingClearance(frames: readonly HumanoidCaptureFrame[], side: "left" | "right"): number | null {
  const stanceHeights = frames
    .filter(({ diagnostics }) => diagnostics.humanoid.feet[side].contact === "stance")
    .map(({ diagnostics }) => diagnostics.humanoid.feet[side].position[1]);
  const swingHeights = frames
    .filter(({ diagnostics }) => diagnostics.humanoid.feet[side].contact === "swing")
    .map(({ diagnostics }) => diagnostics.humanoid.feet[side].position[1]);
  if (stanceHeights.length === 0 || swingHeights.length === 0) return null;
  return round(Math.max(...swingHeights) - average(stanceHeights));
}

function resolveSwingApexProgress(frames: readonly HumanoidCaptureFrame[], side: "left" | "right"): number | null {
  const swingFrames = frames.filter(({ diagnostics }) => diagnostics.humanoid.feet[side].contact === "swing");
  if (swingFrames.length === 0) return null;
  const apex = swingFrames.reduce((highest, frame) =>
    frame.diagnostics.humanoid.feet[side].position[1] > highest.diagnostics.humanoid.feet[side].position[1]
      ? frame
      : highest,
  );
  return round(apex.diagnostics.humanoid.feet[side].progress);
}

function resolveHumanoidValues(
  frames: readonly ProceduralAnimationFrameCapture[],
  select: (humanoid: NonNullable<ProceduralAnimationFrameCapture["diagnostics"]["humanoid"]>) => (number | null)[],
): number[] {
  return frames
    .flatMap(({ diagnostics }) => (diagnostics.humanoid ? select(diagnostics.humanoid) : []))
    .flatMap(finite);
}

function resolveConsecutiveJointSteps(frames: readonly ProceduralAnimationFrameCapture[]): number[] {
  return frames.slice(1).flatMap((frame, index) => {
    const previous = frames[index];
    const currentHumanoid = frame.diagnostics.humanoid;
    const previousHumanoid = previous.diagnostics.humanoid;
    const humanSteps =
      currentHumanoid && previousHumanoid
        ? Object.entries(currentHumanoid.joints).map(([jointId, position]) =>
            pointDistance(position, previousHumanoid.joints[jointId as keyof typeof currentHumanoid.joints]),
          )
        : [];
    const currentHorse = frame.diagnostics.horse;
    const previousHorse = previous.diagnostics.horse;
    const horseSteps =
      currentHorse && previousHorse
        ? Object.entries(currentHorse.legs).map(([hoofId, leg]) =>
            pointDistance(leg.hoofWorld, previousHorse.legs[hoofId as keyof typeof currentHorse.legs].hoofWorld),
          )
        : [];
    return [...humanSteps, ...horseSteps];
  });
}

function resolveConsecutiveFootAngularSteps(
  frames: readonly ProceduralAnimationFrameCapture[],
  stableStanceOnly = false,
): number[] {
  const humanoidFrames = frames.filter((frame): frame is HumanoidCaptureFrame => Boolean(frame.diagnostics.humanoid));
  return resolveFootAngularStepEvents(humanoidFrames, stableStanceOnly).map(({ angleDegrees }) => angleDegrees);
}

function resolveFootAngularStepEvents(
  frames: readonly HumanoidCaptureFrame[],
  stableStanceOnly = false,
): ProceduralFootAngularStepEvent[] {
  return frames.slice(1).flatMap((frame, index) => {
    const previous = frames[index];
    return (["left", "right"] as const).flatMap((side) => {
      const currentFoot = frame.diagnostics.humanoid.feet[side];
      const previousFoot = previous.diagnostics.humanoid.feet[side];
      if (!currentFoot.rotation || !previousFoot.rotation) return [];
      if (
        stableStanceOnly &&
        (currentFoot.contact !== "stance" ||
          previousFoot.contact !== "stance" ||
          !isStableContact(currentFoot.progress) ||
          !isStableContact(previousFoot.progress))
      ) {
        return [];
      }
      return [
        {
          angleDegrees: round(resolveQuaternionAngularDistanceDegrees(currentFoot.rotation, previousFoot.rotation)),
          contact: currentFoot.contact,
          frameIndex: frame.frameIndex,
          progress: currentFoot.progress,
          side,
        },
      ];
    });
  });
}

function maximumFootAngularStepEvent(
  events: readonly ProceduralFootAngularStepEvent[],
): ProceduralFootAngularStepEvent | null {
  return events.reduce<ProceduralFootAngularStepEvent | null>(
    (maximumEvent, event) => (!maximumEvent || event.angleDegrees > maximumEvent.angleDegrees ? event : maximumEvent),
    null,
  );
}

function resolveFootAngularTravel(frames: readonly HumanoidCaptureFrame[], side: "left" | "right"): number | null {
  const rotations = frames.flatMap(({ diagnostics }) => {
    const rotation = diagnostics.humanoid.feet[side].rotation;
    return rotation ? [rotation] : [];
  });
  if (rotations.length < 2) return null;
  return round(
    rotations.slice(1).reduce((travel, rotation, index) => {
      return travel + resolveQuaternionAngularDistanceDegrees(rotation, rotations[index]);
    }, 0),
  );
}

function resolveStanceContactDrifts(
  frames: readonly ProceduralAnimationFrameCapture[],
  stableContactOnly = false,
): number[] {
  return frames.slice(1).flatMap((frame, index) => {
    const previous = frames[index];
    const footDrifts = (["left", "right"] as const).flatMap((side) => {
      const currentFoot = frame.diagnostics.humanoid?.feet[side];
      const previousFoot = previous.diagnostics.humanoid?.feet[side];
      return currentFoot?.contact === "stance" &&
        previousFoot?.contact === "stance" &&
        (!stableContactOnly || (isStableContact(currentFoot.progress) && isStableContact(previousFoot.progress)))
        ? [pointDistance(currentFoot.position, previousFoot.position)]
        : [];
    });
    const hoofDrifts = (["frontLeft", "frontRight", "hindLeft", "hindRight"] as const).flatMap((hoofId) => {
      const currentHoof = frame.diagnostics.horse?.legs[hoofId];
      const previousHoof = previous.diagnostics.horse?.legs[hoofId];
      return currentHoof?.contact === "stance" && previousHoof?.contact === "stance"
        ? [pointDistance(currentHoof.hoofWorld, previousHoof.hoofWorld)]
        : [];
    });
    return [...footDrifts, ...hoofDrifts];
  });
}

function isStableContact(progress: number): boolean {
  return progress >= 0.1 && progress <= 0.9;
}

function pointDistance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function range(values: readonly number[]): { maximum: number | null; minimum: number | null } {
  return { maximum: maximum(values), minimum: minimum(values) };
}

function maximum(values: readonly (number | null)[]): number | null {
  const finiteValues = values.flatMap(finite);
  return finiteValues.length > 0 ? round(Math.max(...finiteValues)) : null;
}

function minimum(values: readonly (number | null)[]): number | null {
  const finiteValues = values.flatMap(finite);
  return finiteValues.length > 0 ? round(Math.min(...finiteValues)) : null;
}

function finite(value: number | null): number[] {
  return value !== null && Number.isFinite(value) ? [value] : [];
}

function round(value: number): number {
  return Number(value.toFixed(5));
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
