import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { DOORWAY_WORDS } from "@/shell/words";

import { RetryNotice } from "./retry-notice";

/**
 * A view that could not be drawn in a running game, above the foot rows: the player stays on the view they had, this
 * line says which one did not open, and Try again loads the game afresh.
 */
export const SceneFailureNotice = () => {
  const failed = usePlayRouteReadinessStore((state) => state.sceneFailure?.scene ?? null);
  if (!failed) return null;
  return (
    <RetryNotice
      line={failed === "map" ? DOORWAY_WORDS.mapNotDrawn : DOORWAY_WORDS.realmNotDrawn}
      onRetry={() => window.location.reload()}
    />
  );
};
