import type { OnboardingPhase } from "@/hooks/context/use-unified-onboarding";

const ONBOARDING_SCREEN_PHASES: ReadonlySet<OnboardingPhase> = new Set(["world-select", "account", "loading"]);

/**
 * Keep the onboarding shell mounted until all world dependencies are ready.
 * This prevents fallback screen swaps that cause visible flashes.
 */
export const shouldRenderOnboardingScreen = (
  phase: OnboardingPhase,
  hasSetupResult: boolean,
  hasAccount: boolean,
): boolean => ONBOARDING_SCREEN_PHASES.has(phase) || !hasSetupResult || !hasAccount;

/**
 * When the shell is mounted only as a dependency bridge (not a true onboarding phase),
 * force the loading phase so the panel always has stable content.
 */
export const resolveOnboardingPhaseForScreen = (
  phase: OnboardingPhase,
  hasSetupResult: boolean,
  hasAccount: boolean,
): OnboardingPhase => {
  if (ONBOARDING_SCREEN_PHASES.has(phase)) {
    return phase;
  }

  return !hasSetupResult || !hasAccount ? "loading" : phase;
};

/**
 * The transition fade overlay should not stack on top of the onboarding/game-entry overlay.
 */
export const shouldShowTransitionLoadingOverlay = (
  showBlankOverlay: boolean,
  isLoadingScreenEnabled: boolean,
): boolean => isLoadingScreenEnabled && !showBlankOverlay;
