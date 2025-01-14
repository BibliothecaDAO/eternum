import { HintSection } from "@/ui/components/hints/hint-modal";
import { social } from "@/ui/components/navigation/config";
import { ExpandableOSWindow } from "@/ui/components/navigation/os-window";
import { GuildMembers } from "@/ui/components/worldmap/guilds/guild-members";
import { Guilds } from "@/ui/components/worldmap/guilds/guilds";
import { PlayersPanel } from "@/ui/components/worldmap/players/players-panel";
import Button from "@/ui/elements/button";
import { Tabs } from "@/ui/elements/tab";
import { ContractAddress, ID, Player } from "@bibliothecadao/eternum";
import { useDojo, useHyperstructureData, useLeaderBoardStore, useUIStore } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { EndSeasonButton } from "./end-season-button";
import { PlayerId } from "./player-id";

export const Social = ({ getPlayers }: { getPlayers: () => Player[] }) => {
  const {
    setup: {
      components: {
        events: { GameEnded },
      },
    },
  } = useDojo();
  const [selectedTab, setSelectedTab] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<ID>(0);
  const [selectedPlayer, setSelectedPlayer] = useState<ContractAddress>(0n);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(social));

  const gameEnded = useEntityQuery([Has(GameEnded)]);

  const [players, setPlayers] = useState(() => getPlayers());
  const playersByRank = useLeaderBoardStore((state) => state.playersByRank);

  const updateLeaderboard = useHyperstructureData();

  const handleUpdatePoints = () => {
    setIsLoading(true);
    updateLeaderboard();
  };

  useEffect(() => {
    setPlayers(getPlayers());
    setIsLoading(false);
  }, [playersByRank]);

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
        key: "Players",
        label: <div>Players</div>,
        component: <PlayersPanel players={players} viewPlayerInfo={viewPlayerInfo} />,
        expandedContent: <PlayerId selectedPlayer={selectedPlayer} />,
      },
      {
        key: "Guild",
        label: <div>Tribes</div>,
        component: <Guilds players={players} viewGuildMembers={viewGuildMembers} />,
        expandedContent: selectedPlayer ? (
          <PlayerId selectedPlayer={selectedPlayer} selectedGuild={selectedGuild} back={() => viewPlayerInfo(0n)} />
        ) : (
          <GuildMembers
            players={players}
            selectedGuildEntityId={selectedGuild}
            viewPlayerInfo={viewPlayerInfo}
            setIsExpanded={setIsExpanded}
          />
        ),
      },
    ],
    [selectedTab, isExpanded, selectedGuild, selectedPlayer, updateLeaderboard],
  );

  return (
    <ExpandableOSWindow
      width="800px"
      widthExpanded="400px"
      onClick={() => togglePopup(social)}
      show={isOpen}
      title={social}
      hintSection={HintSection.Tribes}
      childrenExpanded={tabs[selectedTab].expandedContent}
      isExpanded={isExpanded}
    >
      <Tabs
        size="medium"
        selectedIndex={selectedTab}
        onChange={(index: number) => {
          setSelectedTab(index);
          setIsExpanded(false);
          setSelectedPlayer(0n);
        }}
        className="h-full"
      >
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.key}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>

        <div className="flex justify-center gap-8">
          {gameEnded.length === 0 && <EndSeasonButton />}
          <Button isLoading={isLoading} variant="secondary" onClick={handleUpdatePoints}>
            Update Points
          </Button>
        </div>

        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab) => (
            <Tabs.Panel key={tab.key}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </ExpandableOSWindow>
  );
};
