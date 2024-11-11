import useUIStore from "@/hooks/store/useUIStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { social } from "@/ui/components/navigation/Config";
import { ExpandableOSWindow } from "@/ui/components/navigation/OSWindow";
import { GuildMembers } from "@/ui/components/worldmap/guilds/GuildMembers";
import { Guilds } from "@/ui/components/worldmap/guilds/Guilds";
import { PlayersPanel } from "@/ui/components/worldmap/players/PlayersPanel";
import { Tabs } from "@/ui/elements/tab";
import { ContractAddress, ID, Player } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { EndSeasonButton } from "./EndSeasonButton";
import { PlayerId } from "./PlayerId";

export const Social = ({ players }: { players: Player[] }) => {
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
      {
        key: "Players",
        label: <div>Players</div>,
        component: <PlayersPanel players={players} viewPlayerInfo={viewPlayerInfo} />,
        expandedContent: <PlayerId selectedPlayer={selectedPlayer} />,
      },
    ],
    [selectedTab, isExpanded, selectedGuild, selectedPlayer],
  );

  return (
    <ExpandableOSWindow
      width="400px"
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
