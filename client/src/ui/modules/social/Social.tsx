import useUIStore from "@/hooks/store/useUIStore";
import { social } from "@/ui/components/navigation/Config";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { GuildMembers } from "@/ui/components/worldmap/guilds/GuildMembers";
import { Guilds } from "@/ui/components/worldmap/guilds/Guilds";
import { PlayersPanel } from "@/ui/components/worldmap/players/PlayersPanel";
import { Tabs } from "@/ui/elements/tab";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
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
        label: <div>Guilds</div>,
        component: <Guilds viewGuildMembers={viewGuildMembers} />,
        expandedContent: selectedPlayer
          ? isExpanded && (
              <PlayerId selectedPlayer={selectedPlayer} selectedGuild={selectedGuild} back={() => viewPlayerInfo(0n)} />
            )
          : isExpanded && <GuildMembers selectedGuildEntityId={selectedGuild} viewPlayerInfo={viewPlayerInfo} />,
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
    <OSWindow
      width="400px"
      expandedWidth={"800px"}
      onClick={() => togglePopup(social)}
      show={isOpen}
      title={social}
      hintSection={"guilds"}
      isExpandable={true}
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
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab) => (
            <Tabs.Panel key={tab.key}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </OSWindow>
  );
};
