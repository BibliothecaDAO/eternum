import { useUIStore } from "@/hooks/store/use-ui-store";
import { OSWindow } from "@/ui/components/navigation/os-window";
import Button from "@/ui/elements/button";
import { getBlockTimestamp } from "@/utils/timestamp";
import { configManager, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useCallback, useMemo, useState } from "react";

interface EndSeasonButtonProps {
  className?: string;
}

export const EndSeasonButton = ({ className }: EndSeasonButtonProps) => {
  const dojo = useDojo();
  const {
    setup,
    account: { account },
  } = dojo;

  const [isLoading, setIsLoading] = useState(false);
  const [showCongratsPopup, setShowCongratsPopup] = useState(false);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;
  const seasonWinner = useUIStore((state) => state.seasonWinner);

  const isSeasonOver = Boolean(seasonWinner);

  const pointsForWin = configManager.getHyperstructureConfig().pointsForWin;

  const { registeredPoints, percentageOfPoints } = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(setup.components);
    const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(ContractAddress(account.address));

    return { registeredPoints, percentageOfPoints: Math.min((registeredPoints / pointsForWin) * 100, 100) };
  }, [structureEntityId, currentBlockTimestamp]);

  const hasReachedFinalPoints = useMemo(() => {
    return percentageOfPoints >= 100;
  }, [percentageOfPoints]);

  const endGame = useCallback(async () => {
    if (!hasReachedFinalPoints || isSeasonOver) {
      return;
    }
    setIsLoading(true);
    try {
      await setup.systemCalls.end_game({
        signer: account,
      });
      // Show congratulations popup on successful season end
      setShowCongratsPopup(true);
    } finally {
      setIsLoading(false);
    }
  }, [hasReachedFinalPoints, isSeasonOver]);

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

      <OSWindow
        show={showCongratsPopup}
        onClick={() => setShowCongratsPopup(false)}
        title="🔥 Congratulations! 🔥"
        width="500px"
        height="h-auto"
      >
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="text-6xl">🏆</div>
          <h2 className="text-2xl font-bold text-gold">You have conquered Eternum Season 1!</h2>
          <Button variant="primary" onClick={() => setShowCongratsPopup(false)} className="mt-4">
            Close
          </Button>
        </div>
      </OSWindow>
    </>
  );
};
