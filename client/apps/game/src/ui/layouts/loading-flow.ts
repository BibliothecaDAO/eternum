/**
 * The transition fade overlay should not stack on top of the onboarding/game-entry overlay.
 */
export const shouldShowTransitionLoadingOverlay = (
  showBlankOverlay: boolean,
  isLoadingScreenEnabled: boolean,
): boolean => isLoadingScreenEnabled && !showBlankOverlay;
