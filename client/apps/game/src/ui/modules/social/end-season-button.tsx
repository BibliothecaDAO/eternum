import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { getBlockTimestamp } from "@/utils/timestamp";
import { configManager, LeaderboardManager } from "@bibliothecadao/eternum";
import { ContractAddress } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
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
  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const currentBlockTimestamp = getBlockTimestamp().currentBlockTimestamp;

  const pointsForWin = configManager.getHyperstructureConfig().pointsForWin;

  const isSeasonOver = useMemo(() => {
    return LeaderboardManager.instance(setup.components).isSeasonOver();
  }, []);

  const { playerPoints, percentageOfPoints } = useMemo(() => {
    const playersByRank = LeaderboardManager.instance(setup.components).playersByRank;
    const player = playersByRank.find(([player, _]) => ContractAddress(player) === ContractAddress(account.address));
    const playerPoints = player?.[1] ?? 0;

    return { playerPoints, percentageOfPoints: Math.min((playerPoints / pointsForWin) * 100, 100) };
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
    } finally {
      setIsLoading(false);
    }
  }, [hasReachedFinalPoints, isSeasonOver]);

  return (
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
                {playerPoints.toLocaleString()} / {pointsForWin.toLocaleString()}
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
    </Button>
  );
};
