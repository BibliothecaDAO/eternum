import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetHyperstructuresWithContributionsFromPlayer } from "@/hooks/helpers/useContributions";
import { useGetPlayerEpochs } from "@/hooks/helpers/useHyperstructures";
import useUIStore from "@/hooks/store/useUIStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { social } from "@/ui/components/navigation/Config";
import { ExpandableOSWindow } from "@/ui/components/navigation/OSWindow";
import { GuildMembers } from "@/ui/components/worldmap/guilds/GuildMembers";
import { Guilds } from "@/ui/components/worldmap/guilds/Guilds";
import { PlayersPanel } from "@/ui/components/worldmap/players/PlayersPanel";
import Button from "@/ui/elements/Button";
import { Tabs } from "@/ui/elements/tab";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { PlayerId } from "./PlayerId";

export const Social = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const [selectedGuild, setSelectedGuild] = useState<ID>(0);
  const [selectedPlayer, setSelectedPlayer] = useState<ContractAddress>(0n);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(social));

  const viewGuildMembers = (guildEntityId: ID) => {
    if (selectedGuild === guildEntityId) {
      setSelectedPlayer(0n);
      setIsExpanded(!isExpanded);
    } else {
      setSelectedGuild(guildEntityId);
      setIsExpanded(true);
    }
  };

  const viewPlayerInfo = (playerAddress: ContractAddress) => {
    if (selectedPlayer === playerAddress) {
      setIsExpanded(!isExpanded);
    } else {
      setSelectedPlayer(playerAddress);
      setIsExpanded(true);
    }
  };

  const tabs = useMemo(
    () => [
      {
        key: "Guild",
        label: <div>Tribes</div>,
        component: <Guilds viewGuildMembers={viewGuildMembers} />,
        expandedContent: selectedPlayer
          ? isExpanded && (
              <PlayerId selectedPlayer={selectedPlayer} selectedGuild={selectedGuild} back={() => viewPlayerInfo(0n)} />
            )
          : isExpanded && (
              <GuildMembers
                selectedGuildEntityId={selectedGuild}
                viewPlayerInfo={viewPlayerInfo}
                setIsExpanded={setIsExpanded}
              />
            ),
      },
      {
        key: "Players",
        label: <div>Players</div>,
        component: <PlayersPanel viewPlayerInfo={viewPlayerInfo} />,
        expandedContent: isExpanded && <PlayerId selectedPlayer={selectedPlayer} />,
      },
    ],
    [selectedTab, isExpanded, selectedGuild, selectedPlayer],
  );

  return (
    <ExpandableOSWindow
      width="400px"
      expandedWidth="800px"
      onClick={() => togglePopup(social)}
      show={isOpen}
      title={social}
      hintSection={HintSection.Tribes}
      expandedContent={tabs[selectedTab].expandedContent}
      isExpanded={isExpanded}
    >
      <Tabs
        size="medium"
        selectedIndex={selectedTab}
        onChange={(index: number) => {
          setSelectedTab(index);
          setIsExpanded(false);
        }}
        className="h-full"
      >
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.key}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>

        <EndSeasonButton />

        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab) => (
            <Tabs.Panel key={tab.key}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </ExpandableOSWindow>
  );
};

const EndSeasonButton = () => {
  const {
    setup,
    account: { account },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp!;

  const getContributions = useGetHyperstructuresWithContributionsFromPlayer();
  const getEpochs = useGetPlayerEpochs();

  const percentageOfPoints = useMemo(() => {
    const playersByRank = LeaderboardManager.instance().getPlayersByRank(nextBlockTimestamp);
    const player = playersByRank.find(([player, _]) => ContractAddress(player) === ContractAddress(account.address));
    const playerPoints = player?.[1] ?? 0;

    return Math.min((playerPoints / configManager.getHyperstructureConfig().pointsForWin) * 100, 100);
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
  );
};
