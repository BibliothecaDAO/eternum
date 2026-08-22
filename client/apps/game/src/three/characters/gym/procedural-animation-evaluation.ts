import type { ProceduralAnimationCaptureResult, ProceduralAnimationFrameCapture } from "./procedural-animation-capture";

export interface ProceduralAnimationObjectiveEvaluation {
  blankViewCount: number;
  automatedHardGatePassed: boolean;
  issueCount: number;
  issueFrameCount: number;
  measurements: {
    elbowDegrees: { maximum: number | null; minimum: number | null };
    kneeDegrees: { maximum: number | null; minimum: number | null };
    maximumJointStep: number | null;
    maximumSocketDivergence: number | null;
    maximumStanceContactDrift: number | null;
    minimumArrowHeadClearance: number | null;
    minimumHorseBendAlignment: number | null;
    minimumWeaponHeadClearance: number | null;
  };
  temporalCoverage: boolean;
}

export function evaluateProceduralAnimationCapture(
  result: Pick<ProceduralAnimationCaptureResult, "frames" | "plan">,
): ProceduralAnimationObjectiveEvaluation {
  const blankViewCount = result.frames
    .flatMap(({ views }) => views)
    .filter(({ imageNonBlank }) => !imageNonBlank).length;
  const issueCount = result.frames.reduce((count, frame) => count + frame.issues.length, 0);
  const temporalCoverage = result.plan.sampling === "all-frames";
  return {
    blankViewCount,
    automatedHardGatePassed: blankViewCount === 0 && issueCount === 0,
    issueCount,
    issueFrameCount: result.frames.filter(({ issues }) => issues.length > 0).length,
    measurements: {
      elbowDegrees: range(
        resolveHumanoidValues(result.frames, ({ arms }) => [arms.left.elbowDegrees, arms.right.elbowDegrees]),
      ),
      kneeDegrees: range(
        resolveHumanoidValues(result.frames, ({ legs }) => [legs.left.kneeDegrees, legs.right.kneeDegrees]),
      ),
      maximumJointStep: temporalCoverage ? maximum(resolveConsecutiveJointSteps(result.frames)) : null,
      maximumSocketDivergence: maximum(
        resolveHumanoidValues(result.frames, ({ arms }) => [arms.left.solverSocketError, arms.right.solverSocketError]),
      ),
      maximumStanceContactDrift: temporalCoverage ? maximum(resolveStanceContactDrifts(result.frames)) : null,
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

function resolveStanceContactDrifts(frames: readonly ProceduralAnimationFrameCapture[]): number[] {
  return frames.slice(1).flatMap((frame, index) => {
    const previous = frames[index];
    const footDrifts = (["left", "right"] as const).flatMap((side) => {
      const currentFoot = frame.diagnostics.humanoid?.feet[side];
      const previousFoot = previous.diagnostics.humanoid?.feet[side];
      return currentFoot?.contact === "stance" && previousFoot?.contact === "stance"
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
