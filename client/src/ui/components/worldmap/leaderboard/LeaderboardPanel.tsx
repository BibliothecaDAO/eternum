import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetHyperstructuresWithContributionsFromPlayer } from "@/hooks/helpers/useContributions";
import { useGetPlayerEpochs } from "@/hooks/helpers/useHyperstructures";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { ContractAddress } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { GuildsLeaderboard } from "./GuildsLeaderboard";
import { PlayersLeaderboard } from "./PlayersLeaderboard";

export const LeaderboardPanel = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const {
    account: { account },
    setup,
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp)!;

  const getContributions = useGetHyperstructuresWithContributionsFromPlayer();
  const getEpochs = useGetPlayerEpochs();

  const percentageOfPoints = useMemo(() => {
    const playersByRank = LeaderboardManager.instance().getPlayersByRank(useUIStore.getState().nextBlockTimestamp!);
    const player = playersByRank.find(([player, _]) => ContractAddress(player) === ContractAddress(account.address));
    const playerPoints = player?.[1] ?? 0;

    return Math.min((playerPoints / configManager.getHyperstructureConfig().pointsForWin) * 100, 100);
  }, [structureEntityId, nextBlockTimestamp]);

  const hasReachedFinalPoints = useMemo(() => {
    return percentageOfPoints >= 100;
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

  const gradient = useMemo(() => {
    const filledPercentage = percentageOfPoints;
    const emptyPercentage = 1 - percentageOfPoints;
    return `linear-gradient(to right, #f3c99f80 ${filledPercentage}%, #f3c99f80 ${filledPercentage}%, #0000000d ${filledPercentage}%, #0000000d ${
      filledPercentage + emptyPercentage
    }%)`;
  }, [percentageOfPoints]);

  const tabs = useMemo(
    () => [
      {
        key: "playersLeaderboard",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Players</div>
          </div>
        ),
        component: <PlayersLeaderboard />,
      },
      {
        key: "guildsLeaderboard",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Guilds</div>
          </div>
        ),
        component: <GuildsLeaderboard />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setSelectedTab(index)}
        variant="default"
        className="h-full"
      >
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Button
          variant="outline"
          size="xs"
          className={clsx("self-center")}
          onMouseOver={() => {
            if (!hasReachedFinalPoints) {
              setTooltip({
                position: "bottom",
                content: (
                  <span className="whitespace-nowrap pointer-events-none">
                    <span>Not enough points to end the season</span>
                  </span>
                ),
              });
            }
          }}
          onMouseOut={() => {
            setTooltip(null);
          }}
          style={{ background: gradient }}
          onClick={endGame}
        >
          End season
        </Button>
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </>
  );
};
