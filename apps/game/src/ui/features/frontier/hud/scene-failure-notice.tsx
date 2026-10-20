import { DOORWAY_WORDS } from "@/ui/design-system/kit/words";
import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";

/**
 * A view that could not be drawn in a running game, above the foot rows: the player stays on the view they had, this
 * line says which one did not open, and Try again loads the game afresh.
 */
export const SceneFailureNotice = () => {
  const failed = usePlayRouteReadinessStore((state) => state.sceneFailure?.scene ?? null);
  if (!failed) return null;
  return (
    <HudNotice
      tone="bad"
      line={failed === "map" ? DOORWAY_WORDS.mapNotDrawn : DOORWAY_WORDS.realmNotDrawn}
      retry={() => window.location.reload()}
    />
  );
};
