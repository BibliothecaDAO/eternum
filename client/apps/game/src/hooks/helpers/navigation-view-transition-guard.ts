type ViewScene = "map" | "hex" | "other";

interface ViewTransitionGuardDecisionInput {
  nowMs: number;
  guardUntilMs: number;
  fromScene: ViewScene;
  toScene: ViewScene;
  cooldownMs: number;
  isTransitionInFlight: boolean;
}

interface ViewTransitionGuardDecision {
  shouldBlockTransition: boolean;
  nextGuardUntilMs: number;
}

function isWorldLocalScene(scene: ViewScene): boolean {
  return scene === "map" || scene === "hex";
}

function isWorldLocalNavigation(fromScene: ViewScene, toScene: ViewScene): boolean {
  return isWorldLocalScene(fromScene) && isWorldLocalScene(toScene);
}

export const resolveViewTransitionGuardDecision = (
  input: ViewTransitionGuardDecisionInput,
): ViewTransitionGuardDecision => {
  const isWorldLocalNavigationRequested = isWorldLocalNavigation(input.fromScene, input.toScene);
  if (!isWorldLocalNavigationRequested) {
    return {
      shouldBlockTransition: false,
      nextGuardUntilMs: input.guardUntilMs,
    };
  }

  if (input.isTransitionInFlight || input.nowMs < input.guardUntilMs) {
    return {
      shouldBlockTransition: true,
      nextGuardUntilMs: input.guardUntilMs,
    };
  }

  if (input.fromScene === input.toScene) {
    return {
      shouldBlockTransition: false,
      nextGuardUntilMs: input.guardUntilMs,
    };
  }

  return {
    shouldBlockTransition: false,
    nextGuardUntilMs: input.nowMs + Math.max(0, input.cooldownMs),
  };
};
