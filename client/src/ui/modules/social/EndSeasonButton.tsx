import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetHyperstructuresWithContributionsFromPlayer } from "@/hooks/helpers/useContributions";
import { useGetPlayerEpochs } from "@/hooks/helpers/useHyperstructures";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { ContractAddress } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useCallback, useMemo } from "react";

export const EndSeasonButton = () => {
  const {
    setup,
    account: { account },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp!;

  const getContributions = useGetHyperstructuresWithContributionsFromPlayer();
  const getEpochs = useGetPlayerEpochs();

  const pointsForWin = configManager.getHyperstructureConfig().pointsForWin;

  const { playerPoints, percentageOfPoints } = useMemo(() => {
    const playersByRank = LeaderboardManager.instance().getPlayersByRank(nextBlockTimestamp);
    const player = playersByRank.find(([player, _]) => ContractAddress(player) === ContractAddress(account.address));
    const playerPoints = player?.[1] ?? 0;

    return { playerPoints, percentageOfPoints: Math.min((playerPoints / pointsForWin) * 100, 100) };
  }, [structureEntityId, nextBlockTimestamp]);

  const hasReachedFinalPoints = useMemo(() => {
    return percentageOfPoints >= 100;
  }, [percentageOfPoints]);

  const gradient = useMemo(() => {
    const filledPercentage = percentageOfPoints;
    const emptyPercentage = 1 - percentageOfPoints;
    return `linear-gradient(to right, #f3c99f80 ${filledPercentage}%, #f3c99f80 ${filledPercentage}%, #0000000d ${filledPercentage}%, #0000000d ${
      filledPercentage + emptyPercentage
    }%)`;
  }, [percentageOfPoints]);

  const endGame = useCallback(async () => {
    if (!hasReachedFinalPoints) {
      return;
    }
    const contributions = Array.from(getContributions());
    const epochs = getEpochs();

    await setup.systemCalls.end_game({
      signer: account,
      hyperstructure_contributed_to: contributions,
      hyperstructure_shareholder_epochs: epochs,
    });
  }, [hasReachedFinalPoints, getContributions]);

  return (
    <Button
      variant="outline"
      size="xs"
      className={clsx("self-center")}
      onMouseOver={() => {
        setTooltip({
          position: "bottom",
          content: (
            <span className="flex flex-col whitespace-nowrap pointer-events-none">
              <span className="flex justify-center">
                {playerPoints.toLocaleString()} / {pointsForWin.toLocaleString()}
              </span>
              {!hasReachedFinalPoints && <span>Not enough points to end the season</span>}
            </span>
          ),
        });
      }}
      onMouseOut={() => {
        setTooltip(null);
      }}
      style={{ background: gradient }}
      onClick={endGame}
    >
      End season
    </Button>
  );
};
