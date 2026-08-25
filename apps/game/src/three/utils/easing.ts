import { registerDebugHook, type DebugHookInstallOptions } from "./debug-hooks";

/**
 * Easing functions for smooth, juicy animations
 *
 * These functions take a linear progress value (0-1) and return an eased progress value (0-1)
 * Used to make army movements feel more dynamic and satisfying
 */

export enum EasingType {
  Linear = "linear",
  EaseOut = "easeOut",
  EaseIn = "easeIn",
  EaseInOut = "easeInOut",
  EaseOutCubic = "easeOutCubic",
  EaseOutQuart = "easeOutQuart",
  EaseOutBack = "easeOutBack",
  EaseJourney = "easeJourney",
}

/**
 * Linear easing (no change) - current behavior
 */
function easeLinear(t: number): number {
  return t;
}

/**
 * Ease-out (fast start, slow end) - RECOMMENDED for army movement
 * Creates satisfying "arrive at destination" feeling
 */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2);
}

/**
 * Ease-in (slow start, fast end)
 * Good for dramatic departures
 */
function easeIn(t: number): number {
  return t * t;
}

/**
 * Ease-in-out (slow start, fast middle, slow end)
 * Most natural feeling for long movements
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Ease-out cubic (more dramatic slow-down)
 * Great for "heavy" units that need time to stop
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-out quartic (very dramatic slow-down)
 * Perfect for large armies or important movements
 */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Ease-out back (slight overshoot then settle)
 * Adds extra juice - armies "lean into" their destination
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Journey easing — three-phase curve optimized for travel:
 * - t < 0.15: cubic ease-in (slow departure)
 * - 0.15 <= t <= 0.85: linear cruise
 * - t > 0.85: cubic ease-out (slow arrival)
 * Continuous: easeJourney(0)=0, easeJourney(1)=1
 */
function easeJourney(t: number): number {
  const easeInEnd = 0.15;
  const easeOutStart = 0.85;

  if (t <= 0) return 0;
  if (t >= 1) return 1;

  if (t < easeInEnd) {
    // Cubic ease-in: remap [0, 0.15] -> [0, 1], apply cubic, remap to [0, 0.15]
    const local = t / easeInEnd; // 0..1
    return easeInEnd * (local * local * local);
  } else if (t <= easeOutStart) {
    // Linear cruise: remap [0.15, 0.85] -> [0.15, 0.85]
    return t;
  } else {
    // Cubic ease-out: remap [0.85, 1.0] -> [0, 1], apply cubic ease-out, remap to [0.85, 1.0]
    const local = (t - easeOutStart) / (1 - easeOutStart); // 0..1
    return easeOutStart + (1 - easeOutStart) * (1 - Math.pow(1 - local, 3));
  }
}

/**
 * Main easing function dispatcher
 * Apply the specified easing curve to linear progress
 */
export function applyEasing(progress: number, easingType: EasingType = EasingType.EaseOut): number {
  // Clamp progress to valid range
  const clampedProgress = Math.max(0, Math.min(1, progress));

  switch (easingType) {
    case EasingType.Linear:
      return easeLinear(clampedProgress);
    case EasingType.EaseOut:
      return easeOut(clampedProgress);
    case EasingType.EaseIn:
      return easeIn(clampedProgress);
    case EasingType.EaseInOut:
      return easeInOut(clampedProgress);
    case EasingType.EaseOutCubic:
      return easeOutCubic(clampedProgress);
    case EasingType.EaseOutQuart:
      return easeOutQuart(clampedProgress);
    case EasingType.EaseOutBack:
      return easeOutBack(clampedProgress);
    case EasingType.EaseJourney:
      return easeJourney(clampedProgress);
    default:
      return easeOut(clampedProgress); // Default to recommended easing
  }
}

/**
 * Get easing function description for debugging
 */
function getEasingDescription(easingType: EasingType): string {
  const descriptions = {
    [EasingType.Linear]: "Constant speed (current behavior)",
    [EasingType.EaseOut]: "Fast start → slow finish (RECOMMENDED)",
    [EasingType.EaseIn]: "Slow start → fast finish",
    [EasingType.EaseInOut]: "Slow → fast → slow (natural)",
    [EasingType.EaseOutCubic]: "Dramatic slow-down (heavy units)",
    [EasingType.EaseOutQuart]: "Very dramatic slow-down (large armies)",
    [EasingType.EaseOutBack]: "Slight overshoot + settle (extra juicy)",
    [EasingType.EaseJourney]: "Ease-in cruise ease-out (journey travel)",
  };

  return descriptions[easingType] || "Unknown easing type";
}

export function installEasingDebugHooks(options: DebugHookInstallOptions = {}): void {
  registerDebugHook(
    "testEasing",
    (easingType: EasingType) => {
      console.log(`🎮 Testing ${easingType} easing:`);
      console.log(`   Description: ${getEasingDescription(easingType)}`);

      // Show easing curve samples
      const samples = [0, 0.25, 0.5, 0.75, 1.0];
      console.log(
        "   Progress samples:",
        samples.map((t) => `${(t * 100).toFixed(0)}% → ${(applyEasing(t, easingType) * 100).toFixed(1)}%`).join(", "),
      );
    },
    options,
  );

  registerDebugHook(
    "listEasingTypes",
    () => {
      console.log("🎮 Available Easing Types:");
      Object.values(EasingType).forEach((type) => {
        console.log(`   • ${type}: ${getEasingDescription(type)}`);
      });
    },
    options,
  );
}

installEasingDebugHooks();
