import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { isCoarsePointer } from "@/utils/pointer";
import { INTENSITY, type Intensity } from "./motion-scale";

/** Reduced motion is the existing setting (it follows the OS): no camera, shake, particles or flash. */
export const useReducedMotion = (): boolean => useWorldAppearanceStore((state) => state.reducedMotion);

/**
 * Whether this device can play a haptic: a touch-first one with the vibration API (Android's browsers). A desktop browser
 * may carry the API with nothing to vibrate, and iOS has none: there Settings draws no Haptics row.
 */
export const canVibrate = (): boolean =>
  isCoarsePointer() && typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** A moment's haptic at its intensity, where the device can vibrate and the Haptics setting is on. */
export const playHaptic = (intensity: Intensity): void => {
  if (!useWorldAppearanceStore.getState().haptics || !canVibrate()) return;
  try {
    navigator.vibrate([...INTENSITY.haptic[intensity]]);
  } catch {
    // A browser that refuses vibration simply stays silent.
  }
};
