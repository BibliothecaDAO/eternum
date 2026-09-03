import type { FactoryLaunchPreset } from "./types";

/**
 * The preset's dev-mode default, which seeds the workspace toggle. On chain, dev mode
 * only relaxes the clock: a dev-on game accepts settling before registration opens and
 * after the main phase starts; a real game holds players to the registration window.
 * A Sandbox preset starts dev-on, everything else dev-off, and the operator can flip it
 * before launching.
 */
export const resolveLaunchDevModeOn = (preset: FactoryLaunchPreset | null): boolean =>
  preset?.defaults.devMode ?? false;
