import type { OnboardingPhase } from "@/hooks/context/use-unified-onboarding";

type GameRouteView = "loading" | "ready" | "reconnect" | "redirect";

const REDIRECT_PHASES: ReadonlySet<OnboardingPhase> = new Set(["world-select"]);

export const resolveGameRouteView = ({
  phase,
  hasSetupResult,
  hasAccount,
  entrySource,
  isReconnectRequired = false,
}: {
  phase: OnboardingPhase;
  hasSetupResult: boolean;
  hasAccount: boolean;
  entrySource: "play-route" | null;
  isReconnectRequired?: boolean;
}): GameRouteView => {
  if (hasSetupResult && hasAccount) {
    return "ready";
  }

  if (entrySource !== "play-route" || REDIRECT_PHASES.has(phase)) {
    return "redirect";
  }

  if (isReconnectRequired) {
    return "reconnect";
  }

  return "loading";
};
