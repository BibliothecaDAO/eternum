/**
 * Easing functions for smooth, juicy animations
 * 
 * These functions take a linear progress value (0-1) and return an eased progress value (0-1)
 * Used to make army movements feel more dynamic and satisfying
 */

export enum EasingType {
  Linear = 'linear',
  EaseOut = 'easeOut',
  EaseIn = 'easeIn', 
  EaseInOut = 'easeInOut',
  EaseOutCubic = 'easeOutCubic',
  EaseOutQuart = 'easeOutQuart',
  EaseOutBack = 'easeOutBack'
}

/**
 * Linear easing (no change) - current behavior
 */
export function easeLinear(t: number): number {
  return t;
}

/**
 * Ease-out (fast start, slow end) - RECOMMENDED for army movement
 * Creates satisfying "arrive at destination" feeling
 */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2);
}

/**
 * Ease-in (slow start, fast end) 
 * Good for dramatic departures
 */
export function easeIn(t: number): number {
  return t * t;
}

/**
 * Ease-in-out (slow start, fast middle, slow end)
 * Most natural feeling for long movements
 */
export function easeInOut(t: number): number {
  return t < 0.5 
    ? 2 * t * t 
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Ease-out cubic (more dramatic slow-down)
 * Great for "heavy" units that need time to stop
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-out quartic (very dramatic slow-down) 
 * Perfect for large armies or important movements
 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Ease-out back (slight overshoot then settle)
 * Adds extra juice - armies "lean into" their destination
 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
    default:
      return easeOut(clampedProgress); // Default to recommended easing
  }
}

/**
 * Get easing function description for debugging
 */
export function getEasingDescription(easingType: EasingType): string {
  const descriptions = {
    [EasingType.Linear]: 'Constant speed (current behavior)',
    [EasingType.EaseOut]: 'Fast start → slow finish (RECOMMENDED)',
    [EasingType.EaseIn]: 'Slow start → fast finish',
    [EasingType.EaseInOut]: 'Slow → fast → slow (natural)',
    [EasingType.EaseOutCubic]: 'Dramatic slow-down (heavy units)',
    [EasingType.EaseOutQuart]: 'Very dramatic slow-down (large armies)',
    [EasingType.EaseOutBack]: 'Slight overshoot + settle (extra juicy)'
  };
  
  return descriptions[easingType] || 'Unknown easing type';
}

// Global debug functions
(window as any).testEasing = (easingType: EasingType) => {
  console.log(`🎮 Testing ${easingType} easing:`);
  console.log(`   Description: ${getEasingDescription(easingType)}`);
  
  // Show easing curve samples
  const samples = [0, 0.25, 0.5, 0.75, 1.0];
  console.log('   Progress samples:', samples.map(t => 
    `${(t*100).toFixed(0)}% → ${(applyEasing(t, easingType)*100).toFixed(1)}%`
  ).join(', '));
};

(window as any).listEasingTypes = () => {
  console.log('🎮 Available Easing Types:');
  Object.values(EasingType).forEach(type => {
    console.log(`   • ${type}: ${getEasingDescription(type)}`);
  });
};