import type { OnboardingPhase } from "@/hooks/context/use-unified-onboarding";

type GameRouteView = "loading" | "ready" | "redirect";

const REQUIRES_LANDING_PHASES: ReadonlySet<OnboardingPhase> = new Set(["world-select", "account", "avatar"]);

export const resolveGameRouteView = ({
  phase,
  hasSetupResult,
  hasAccount,
}: {
  phase: OnboardingPhase;
  hasSetupResult: boolean;
  hasAccount: boolean;
}): GameRouteView => {
  if (hasSetupResult && hasAccount) {
    return "ready";
  }

  if (REQUIRES_LANDING_PHASES.has(phase)) {
    return "redirect";
  }

  return "loading";
};
