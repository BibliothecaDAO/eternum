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
 * Pass optionalTarget to avoid allocations in hot loops.
 */
export function resolveSplinePosition(
  spline: CatmullRomCurve3,
  journeyProgress: number,
  easingType: EasingType,
  optionalTarget?: Vector3,
): Vector3 {
  const clamped = Math.max(0, Math.min(1, journeyProgress));
  const easedProgress = applyEasing(clamped, easingType);
  return spline.getPointAt(easedProgress, optionalTarget);
}

/**
 * Get tangent direction at point with easing applied.
 * Uses arc-length parameterized getTangentAt.
 * Pass optionalTarget to avoid allocations in hot loops.
 */
export function resolveSplineTangent(
  spline: CatmullRomCurve3,
  journeyProgress: number,
  easingType: EasingType,
  optionalTarget?: Vector3,
): Vector3 {
  const clamped = Math.max(0, Math.min(1, journeyProgress));
  const easedProgress = applyEasing(clamped, easingType);
  return spline.getTangentAt(easedProgress, optionalTarget);
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
export function resolveAnticipationScale(timer: number, duration: number): { x: number; y: number; z: number } {
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
export function resolveSettlementOffset(timer: number, duration: number, overshootDistance: number): number {
  const t = Math.max(0, Math.min(1, timer / duration));
  // Overshoot then settle: sin(pi*t) peaks at t=0.5, (1-t) damps it
  const curve = Math.sin(t * Math.PI) * (1 - t);
  return overshootDistance * curve;
}

// Pre-allocated vectors to avoid GC pressure in per-frame functions
const _tangent0 = new Vector3();
const _tangent1 = new Vector3();
const _cross = new Vector3();
const _splinePoint = new Vector3();
const _splineTangent = new Vector3();

/**
 * Compute z-axis bank angle from path curvature at parameter t.
 * Cross product of tangent samples around t determines turn direction;
 * y-component sign gives left/right, magnitude gives curvature strength.
 * Result is clamped to [-maxBankRadians, maxBankRadians].
 */
export function resolvePathBankAngle(spline: CatmullRomCurve3, t: number, maxBankRadians: number): number {
  const epsilon = 0.02;
  const t0 = Math.max(0, t - epsilon);
  const t1 = Math.min(1, t + epsilon);

  spline.getTangentAt(t0, _tangent0);
  spline.getTangentAt(t1, _tangent1);

  _cross.crossVectors(_tangent0, _tangent1);

  const curvature = _cross.length() / (2 * epsilon);
  const sign = _cross.y >= 0 ? 1 : -1;

  // Softer mapping (0.3 instead of 0.5) to reduce jitter
  const bankAngle = sign * Math.min(curvature * 0.3, maxBankRadians);
  return Math.max(-maxBankRadians, Math.min(maxBankRadians, bankAngle));
}

/**
 * Vertical sine wave bob + forward pitch lean during movement.
 * Frequency scales gently with speed. Bob is subtle marching rhythm (~1.8 Hz base).
 * Pitch lean is proportional to speed — no lean when stationary.
 */
export function resolveRhythmicBob(input: {
  elapsedTime: number;
  speed: number;
  amplitude: number;
  baseFrequency: number;
}): { yOffset: number; pitchAngle: number } {
  // Gentler frequency scaling: sqrt keeps it from getting frantic at high speeds
  const freq = input.baseFrequency * Math.sqrt(Math.max(0.25, input.speed));
  const phase = input.elapsedTime * freq * Math.PI * 2;
  const yOffset = Math.sin(phase) * input.amplitude;
  // Forward lean proportional to speed (0 lean at speed=0, ~5° at speed=1.25)
  const leanBase = -0.07 * Math.min(1, input.speed / 1.25);
  const pitchAngle = leanBase + Math.cos(phase) * 0.01;
  return { yOffset, pitchAngle };
}

/**
 * Scale punch on arrival: 1.0 -> 1.15 -> 1.0 over duration.
 * Uses sin * exponential decay for fast rise, slow settle.
 */
export function resolveArrivalSlamScale(timer: number, duration: number): { x: number; y: number; z: number } {
  const t = Math.max(0, Math.min(1, timer / duration));
  const punch = Math.sin(t * Math.PI) * Math.exp(-t * 2);
  const scale = 1.0 + 0.15 * punch;
  return { x: scale, y: scale, z: scale };
}

/**
 * Given a spline, current progress, and easing type, returns trailing ghost
 * positions at staggered intervals behind the current position.
 */
export function resolveAfterimagePositions(input: {
  spline: CatmullRomCurve3;
  currentProgress: number;
  easingType: EasingType;
  trailOffsets: number[];
}): { position: Vector3; opacity: number }[] {
  return input.trailOffsets.map((offset, index) => {
    const trailT = Math.max(0, input.currentProgress - offset);
    const position = resolveSplinePosition(input.spline, trailT, input.easingType);
    const opacity = 0.4 * (1 - index / input.trailOffsets.length);
    return { position, opacity };
  });
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
