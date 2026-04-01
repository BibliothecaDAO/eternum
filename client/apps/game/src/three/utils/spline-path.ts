import { CatmullRomCurve3, Vector3 } from "three";
import { applyEasing, EasingType } from "./easing";

/**
 * Build a CatmullRomCurve3 through all waypoints using centripetal parameterization.
 * For 2 points, creates a straight-line curve.
 * For 3+ points, creates a smooth centripetal Catmull-Rom spline.
 */
export function buildMovementSpline(waypoints: Vector3[], tension: number = 0.5): CatmullRomCurve3 {
  if (waypoints.length < 2) {
    throw new Error("buildMovementSpline requires at least 2 waypoints");
  }

  const curve = new CatmullRomCurve3(waypoints, false, "centripetal", tension);
  return curve;
}

/**
 * Sample position on spline with whole-journey easing applied.
 * Uses arc-length parameterized getPointAt for uniform speed.
 */
export function resolveSplinePosition(
  spline: CatmullRomCurve3,
  journeyProgress: number,
  easingType: EasingType,
): Vector3 {
  const clamped = Math.max(0, Math.min(1, journeyProgress));
  const easedProgress = applyEasing(clamped, easingType);
  return spline.getPointAt(easedProgress);
}

/**
 * Get tangent direction at point with easing applied.
 * Uses arc-length parameterized getTangentAt.
 */
export function resolveSplineTangent(
  spline: CatmullRomCurve3,
  journeyProgress: number,
  easingType: EasingType,
): Vector3 {
  const clamped = Math.max(0, Math.min(1, journeyProgress));
  const easedProgress = applyEasing(clamped, easingType);
  return spline.getTangentAt(easedProgress);
}

/**
 * Advance journey progress uniformly based on arc length, speed, and delta time.
 * Returns the next progress value and whether the journey is complete.
 */
export function resolveJourneyProgressUpdate(input: {
  currentProgress: number;
  totalLength: number;
  speed: number;
  deltaTime: number;
}): { nextProgress: number; isComplete: boolean } {
  const { currentProgress, totalLength, speed, deltaTime } = input;

  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return { nextProgress: 1, isComplete: true };
  }

  const progressStep = (speed * deltaTime) / totalLength;
  const nextProgress = currentProgress + progressStep;

  return {
    nextProgress,
    isComplete: nextProgress >= 1,
  };
}

/**
 * Returns scale vector for pre-launch squash animation (anticipation).
 * At timer=0 the model is squashed wide/short; at timer=duration it's normal (1,1,1).
 * Uses smoothstep interpolation for organic feel.
 */
export function resolveAnticipationScale(
  timer: number,
  duration: number,
): { x: number; y: number; z: number } {
  const t = Math.max(0, Math.min(1, timer / duration));
  // smoothstep: t * t * (3 - 2 * t)
  const eased = t * t * (3 - 2 * t);
  const scaleXZ = 1.1 - 0.1 * eased; // 1.1 → 1.0
  const scaleY = 0.85 + 0.15 * eased; // 0.85 → 1.0
  return { x: scaleXZ, y: scaleY, z: scaleXZ };
}

/**
 * Returns offset along final tangent for arrival overshoot.
 * At timer=0 offset is 0, peaks in the middle, returns to 0 at timer=duration.
 * Uses sin curve modulated by (1-t) for a natural settle.
 */
export function resolveSettlementOffset(
  timer: number,
  duration: number,
  overshootDistance: number,
): number {
  const t = Math.max(0, Math.min(1, timer / duration));
  // Overshoot then settle: sin(pi*t) peaks at t=0.5, (1-t) damps it
  const curve = Math.sin(t * Math.PI) * (1 - t);
  return overshootDistance * curve;
}

/**
 * Compute z-axis bank angle from path curvature at parameter t.
 * Cross product of tangent samples around t determines turn direction;
 * y-component sign gives left/right, magnitude gives curvature strength.
 * Result is clamped to [-maxBankRadians, maxBankRadians].
 */
export function resolvePathBankAngle(
  spline: CatmullRomCurve3,
  t: number,
  maxBankRadians: number,
): number {
  const epsilon = 0.01;
  const t0 = Math.max(0, t - epsilon);
  const t1 = Math.min(1, t + epsilon);

  const tangent0 = spline.getTangentAt(t0);
  const tangent1 = spline.getTangentAt(t1);

  // Cross product to find turn direction (y component indicates left/right)
  const cross = new Vector3().crossVectors(tangent0, tangent1);

  // Magnitude of cross product indicates curvature strength
  const curvature = cross.length() / (2 * epsilon);

  // Sign from y component (positive = banking left, negative = banking right)
  const sign = cross.y >= 0 ? 1 : -1;

  // Map curvature to bank angle, clamped
  const bankAngle = sign * Math.min(curvature * 0.5, maxBankRadians);
  return Math.max(-maxBankRadians, Math.min(maxBankRadians, bankAngle));
}

/**
 * Returns a speed multiplier based on biome type.
 * Grassland is faster (1.2x), mountain/desert biomes are slower (0.75x),
 * and all others (including ocean) are normal (1.0x).
 */
export function resolveTerrainSpeedMultiplier(biomeType: string): number {
  switch (biomeType) {
    case "Grassland":
      return 1.2;
    case "SubtropicalDesert":
    case "TemperateDesert":
    case "Bare":
    case "Snow":
    case "Tundra":
    case "Scorched":
      return 0.75;
    default:
      return 1.0;
  }
}
