import { completeNativeBatches } from "@bibliothecadao/provider";
import { useSeasonWinner } from "@/hooks/store/use-story-events-store";
import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { HudButton, HudWindow, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { hasFiniteSeasonEnd } from "@/ui/features/world/utils/season-timing";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { configManager, LeaderboardManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, formatExact } from "@bibliothecadao/types";
import { useCallback, useMemo, useState } from "react";

interface EndSeasonButtonProps {
  className?: string;
}

export const EndSeasonButton = ({ className }: EndSeasonButtonProps) => {
  const game = useGame();
  const facts = useNativeFacts(["PlayerPoints"]);
  const {
    setup,
    account: { account },
  } = game;

  const [isLoading, setIsLoading] = useState(false);
  const [showCongratsPopup, setShowCongratsPopup] = useState(false);
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const { gameEndAt } = useFactView(seasonClockView);
  const seasonWinner = useSeasonWinner();
  const hasFiniteGameEnd = useMemo(() => hasFiniteSeasonEnd(gameEndAt), [gameEndAt]);

  const isSeasonOver = seasonWinner !== null;

  const pointsForWin = configManager.getHyperstructureConfig().pointsForWin;

  const { registeredPoints, percentageOfPoints } = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(facts.store);
    const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(ContractAddress(account.address));

    return {
      registeredPoints,
      percentageOfPoints: registeredPoints === null ? null : Math.min((registeredPoints / pointsForWin) * 100, 100),
    };
  }, [facts, account.address, pointsForWin]);

  const hasReachedFinalPoints = useMemo(() => {
    return percentageOfPoints !== null && percentageOfPoints >= 100;
  }, [percentageOfPoints]);

  const endGame = useCallback(async () => {
    if (!hasFiniteGameEnd || !hasReachedFinalPoints || isSeasonOver) {
      return;
    }
    setIsLoading(true);
    try {
      await completeNativeBatches(() => setup.systemCalls.end_game({ signer: account }));
      const game = setup.store.require("GameRegistry", { game_id: configManager.getActiveGameId() });
      setShowCongratsPopup(Number(game.end_at) <= getBlockTimestamp().currentBlockTimestamp);
    } finally {
      setIsLoading(false);
    }
  }, [hasFiniteGameEnd, hasReachedFinalPoints, isSeasonOver, setup, account]);

  if (!hasFiniteGameEnd) {
    return null;
  }

  return (
    <>
      <span className={className}>
        <HudButton
          kind="primary"
          aria-busy={isLoading}
          disabled={!hasReachedFinalPoints || isSeasonOver || isLoading}
          onMouseOver={() => {
            setTooltip({
              position: "bottom",
              content: (
                <span className="flex flex-col whitespace-nowrap pointer-events-none">
                  <span className="flex justify-center">
                    {registeredPoints === null ? "—" : formatExact(registeredPoints)} / {formatExact(pointsForWin)}
                  </span>
                  {!hasReachedFinalPoints && <span>Not enough points to end the season</span>}
                  {isSeasonOver && <span>Season is already over</span>}
                </span>
              ),
            });
          }}
          onMouseOut={() => {
            setTooltip(null);
          }}
          onClick={endGame}
        >
          End season
        </HudButton>
      </span>

      {showCongratsPopup && (
        <PopoverPanel
          id="season-ended"
          ariaLabel="Season ended"
          anchor="top-center"
          className="w-auto p-0"
          onDismiss={() => setShowCongratsPopup(false)}
        >
          <HudWindow title="🔥 Congratulations! 🔥" size="task" onClose={() => setShowCongratsPopup(false)}>
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="text-hud-display">🏆</div>
              <h2 className="text-hud-display text-hud-accent">You have conquered Eternum Season 1!</h2>
            </div>
            <HudWindowFoot>
              <HudButton kind="primary" onClick={() => setShowCongratsPopup(false)}>
                Close
              </HudButton>
            </HudWindowFoot>
          </HudWindow>
        </PopoverPanel>
      )}
    </>
  );
};
