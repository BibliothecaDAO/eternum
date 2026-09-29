import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { INTENSITY, type Intensity } from "./motion-scale";

/** Reduced motion is the existing setting (it follows the OS): no camera, shake, particles or flash. */
export const useReducedMotion = (): boolean => useWorldAppearanceStore((state) => state.reducedMotion);

/**
 * A moment's haptic at its intensity. Web haptics exist only where navigator.vibrate does (Android); elsewhere this is a
 * silent no-op, and the Haptics setting turns it off everywhere.
 */
export const playHaptic = (intensity: Intensity): void => {
  if (!useWorldAppearanceStore.getState().haptics) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate([...INTENSITY.haptic[intensity]]);
  } catch {
    // A browser that refuses vibration simply stays silent.
  }
};
