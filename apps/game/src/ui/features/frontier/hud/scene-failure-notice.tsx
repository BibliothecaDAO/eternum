import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { DOORWAY_WORDS } from "@/shell/words";
import { Notice } from "@/ui/design-system/kit/notice";
import { TRY_AGAIN } from "@/ui/design-system/kit/words";

/**
 * A view that could not be drawn in a running game, above the foot rows: the player stays on the view they had, this
 * line says which one did not open, and Try again loads the game afresh.
 */
export const SceneFailureNotice = () => {
  const failed = usePlayRouteReadinessStore((state) => state.sceneFailure?.scene ?? null);
  if (!failed) return null;
  return (
    <Notice
      icon={failed === "map" ? "Mp" : "Cs"}
      line={failed === "map" ? DOORWAY_WORDS.mapNotDrawn : DOORWAY_WORDS.realmNotDrawn}
      verb={TRY_AGAIN}
      onVerb={() => window.location.reload()}
      ember
    />
  );
};
