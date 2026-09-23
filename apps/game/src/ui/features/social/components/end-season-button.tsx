import { completeNativeBatches } from "@bibliothecadao/provider";
import { useSeasonWinner } from "@/hooks/store/use-story-events-store";
import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import Button from "@/ui/design-system/atoms/button";
import { hasFiniteSeasonEnd } from "@/ui/features/world/utils/season-timing";
import { PopoverPanel, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import { configManager, LeaderboardManager } from "@bibliothecadao/eternum";
import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useCallback, useMemo, useState } from "react";

interface EndSeasonButtonProps {
  className?: string;
}

export const EndSeasonButton = ({ className }: EndSeasonButtonProps) => {
  const game = useGame();
  const revision = useNativeRevision(["PlayerPoints"]);
  const {
    setup,
    account: { account },
  } = game;

  const [isLoading, setIsLoading] = useState(false);
  const [showCongratsPopup, setShowCongratsPopup] = useState(false);
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { gameEndAt } = useFactView(seasonClockView);
  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;
  const seasonWinner = useSeasonWinner();
  const hasFiniteGameEnd = useMemo(() => hasFiniteSeasonEnd(gameEndAt), [gameEndAt]);

  const isSeasonOver = seasonWinner !== null;

  const pointsForWin = configManager.getHyperstructureConfig().pointsForWin;

  const { registeredPoints, percentageOfPoints } = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(setup.store);
    const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(ContractAddress(account.address));

    return { registeredPoints, percentageOfPoints: Math.min((registeredPoints / pointsForWin) * 100, 100) };
  }, [structureEntityId, currentBlockTimestamp, revision, setup.store, account.address, pointsForWin]);

  const hasReachedFinalPoints = useMemo(() => {
    return percentageOfPoints >= 100;
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
      <Button
        variant="primary"
        isLoading={isLoading}
        disabled={!hasReachedFinalPoints || isSeasonOver}
        className={className}
        onMouseOver={() => {
          setTooltip({
            position: "bottom",
            content: (
              <span className="flex flex-col whitespace-nowrap pointer-events-none">
                <span className="flex justify-center">
                  {registeredPoints.toLocaleString()} / {pointsForWin.toLocaleString()}
                </span>
                {!hasReachedFinalPoints && <span>Not enough registered points to end the season</span>}
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
      </Button>

      {showCongratsPopup && (
        <PopoverPanel
          id="season-ended"
          ariaLabel="Season ended"
          anchor="top-center"
          className="w-auto p-0"
          onDismiss={() => setShowCongratsPopup(false)}
        >
          <SurfaceFrame
            title="🔥 Congratulations! 🔥"
            onClose={() => setShowCongratsPopup(false)}
            className="w-[500px] max-h-[calc(100vh-7rem)]"
          >
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="text-6xl">🏆</div>
              <h2 className="text-2xl font-bold text-gold">You have conquered Eternum Season 1!</h2>
              <Button variant="primary" onClick={() => setShowCongratsPopup(false)} className="mt-4">
                Close
              </Button>
            </div>
          </SurfaceFrame>
        </PopoverPanel>
      )}
    </>
  );
};
