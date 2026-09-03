import type { FactoryLaunchPreset } from "./types";

/**
 * The launch service honors this value as the game's on-chain dev mode: a Sandbox
 * preset (devMode) launches dev-on; a real game launches dev-off so it respects
 * registration and start-time gates (no provisioning or play before the game
 * starts). The one place that maps a preset onto the request field so the three
 * run-request builders can never diverge on it.
 */
export const resolveLaunchDevModeOn = (preset: FactoryLaunchPreset | null): boolean =>
  preset?.defaults.devMode ?? false;
