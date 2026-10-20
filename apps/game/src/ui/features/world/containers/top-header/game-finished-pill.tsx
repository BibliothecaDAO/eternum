import { skipGameEnd } from "@/three/effects/endgame/state";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { requireActiveGame } from "@/runtime/world/store";
import { resultsHref } from "@/shell/season-tab/results-link";
import { HudButton, HudPill } from "@/ui/design-system/kit/hud-elements";
import { Popover } from "@/ui/design-system/molecules/popover";
import { useIsWatching } from "@/utils/can-issue-orders";

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

const GAME_FINISHED_POPOVER_ID = "game-finished";

/**
 * The finished-game surface: a pill where the timer was, with the game's Results one popover away. The map stays
 * reachable — a finished game is still worth looking at — and the game stays booted for a return to it.
 */
export const GameFinishedPill = () => {
  const isOpen = usePopoverStore((state) => state.openId === GAME_FINISHED_POPOVER_ID);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const watching = useIsWatching();
  const navigate = useNavigate();
  const goToResults = useCallback(() => {
    const game = requireActiveGame();
    skipGameEnd();
    navigate(resultsHref({ chainId: game.chainId, game_id: game.gameId }));
  }, [navigate]);

  return (
    <Popover
      id={GAME_FINISHED_POPOVER_ID}
      ariaLabel="Game finished"
      trigger={
        <HudPill
          aria-expanded={isOpen}
          onPress={() => togglePopover(GAME_FINISHED_POPOVER_ID)}
          className="game-finished-pill pointer-events-auto whitespace-nowrap"
        >
          {[
            <span key="finished" className="flex items-center gap-1.5">
              <SemanticIcon name="victory" className="h-3.5 w-3.5" aria-hidden="true" />
              Game finished
            </span>,
          ]}
        </HudPill>
      }
    >
      <div className="flex flex-col gap-3">
        <span className="text-hud-title text-hud-ink">This game has ended</span>
        <span className="text-hud-body text-hud-ink">
          {watching
            ? "The final standings are on its Results page. The map stays open here to scout. Escape skips the mist."
            : "Your place, the standings and rewards are on its Results page. The map stays open here. Escape skips the mist."}
        </span>
        <HudButton kind="primary" onClick={goToResults}>
          See the results
        </HudButton>
      </div>
    </Popover>
  );
};
