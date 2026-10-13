import type { PlayRouteBootPhase } from "@/game-entry/play-route-boot";

type GameRouteView = "error" | "loading" | "ready" | "reconnect" | "redirect";

export const resolveGameRouteView = ({
  phase,
  hasSetupResult,
  hasAccount,
  isReconnectRequired = false,
  sceneFailed = false,
}: {
  phase: PlayRouteBootPhase;
  hasSetupResult: boolean;
  hasAccount: boolean;
  isReconnectRequired?: boolean;
  /** The boot's error is a scene that did not set up: the game itself is loaded and stays, behind the doorway. */
  sceneFailed?: boolean;
}): GameRouteView => {
  // A boot that failed before the game was loaded has nothing to keep. A scene that failed leaves the game standing,
  // so the doorway can still name the player's realm and open its view without the map.
  if (phase === "error" && !sceneFailed) {
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
