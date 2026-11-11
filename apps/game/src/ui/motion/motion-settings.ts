import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { iosAppBridge } from "@/pwa/ios-app-bridge";
import { isCoarsePointer } from "@/utils/pointer";
import { INTENSITY, type Intensity } from "./motion-scale";

/** Reduced motion is the existing setting (it follows the OS): no camera, shake, particles or flash. */
export const useReducedMotion = (): boolean => useWorldAppearanceStore((state) => state.reducedMotion);

/**
 * Whether this device can vibrate: a touch-first one with the vibration API (Android's browsers). A desktop browser may
 * carry the API with nothing to vibrate, and iOS has none.
 */
const canVibrate = (): boolean =>
  isCoarsePointer() && typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** Whether this device plays haptics, the iOS app's through its plugin: only there does Settings draw a Haptics row. */
export const canPlayHaptics = (): boolean => canVibrate() || iosAppBridge() !== null;

/** A moment's haptic at its intensity, where the device can vibrate and the Haptics setting is on. */
export const playHaptic = (intensity: Intensity): void => {
  if (!useWorldAppearanceStore.getState().haptics || !canVibrate()) return;
  try {
    navigator.vibrate([...INTENSITY.haptic[intensity]]);
  } catch {
    // A browser that refuses vibration simply stays silent.
  }
};

/**
 * One light tap when the player's own action is confirmed, in the iOS app only (with the Haptics setting on): part of
 * what makes the app more than its website for App Review. The web and the Android app play none.
 */
export const playActionConfirmedHaptic = (): void => {
  const app = iosAppBridge();
  if (!app || !useWorldAppearanceStore.getState().haptics) return;
  // An app build from before the plugin refuses the call: the web deploy reaches it first, and it stays silent.
  app.nativePromise("Haptics", "impact", { style: "LIGHT" }).catch(() => undefined);
};
