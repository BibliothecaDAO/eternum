import type { PlayRouteBootPhase } from "@/game-entry/play-route-boot";

type GameRouteView = "error" | "loading" | "ready" | "reconnect" | "redirect";

export const resolveGameRouteView = ({
  phase,
  hasSetupResult,
  hasAccount,
  isReconnectRequired = false,
}: {
  phase: PlayRouteBootPhase;
  hasSetupResult: boolean;
  hasAccount: boolean;
  isReconnectRequired?: boolean;
}): GameRouteView => {
  if (phase === "error") {
    return "error";
  }

  if (hasSetupResult && hasAccount) {
    return "ready";
  }

  if (phase === "normalize_route") {
    return "redirect";
  }

  if (isReconnectRequired) {
    return "reconnect";
  }

  return "loading";
};
