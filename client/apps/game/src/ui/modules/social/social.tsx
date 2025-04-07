import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { social } from "@/ui/components/navigation/config";
import { ExpandableOSWindow } from "@/ui/components/navigation/os-window";
import { GuildMembers } from "@/ui/components/worldmap/guilds/guild-members";
import { Guilds } from "@/ui/components/worldmap/guilds/guilds";
import { PlayersPanel } from "@/ui/components/worldmap/players/players-panel";
import Button from "@/ui/elements/button";
import { Tabs } from "@/ui/elements/tab";
import { ContractAddress, getPlayerInfo, LeaderboardManager, PlayerInfo } from "@bibliothecadao/eternum";
import { useDojo, usePlayers } from "@bibliothecadao/react";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { EndSeasonButton } from "./end-season-button";
import { PlayerId } from "./player-id";

export const Social = () => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { claim_construction_points, claim_share_points },
    },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [isSharePointsLoading, setIsSharePointsLoading] = useState(false);
  const [isUpdatePointsLoading, setIsUpdatePointsLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<ContractAddress>(0n);
  const [selectedPlayer, setSelectedPlayer] = useState<ContractAddress>(0n);
  const [playersByRank, setPlayersByRank] = useState<[ContractAddress, number][]>([]);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(social));

  const players = usePlayers();

  useEffect(() => {
    // update first time
    LeaderboardManager.instance(components).updatePoints();
    setPlayersByRank(LeaderboardManager.instance(components).playersByRank);
  }, [components]);

  const [playerInfo, setPlayerInfo] = useState<PlayerInfo[]>(
    getPlayerInfo(players, ContractAddress(account.address), playersByRank, components),
  );

  const hyperstructuresEntityIds = useMemo(() => {
    return Array.from(runQuery([Has(components.Hyperstructure)]))
      .map((entity) => getComponentValue(components.Hyperstructure, entity))
      .filter((hyperstructure) => hyperstructure !== undefined)
      .map((hyperstructure) => hyperstructure.hyperstructure_id);
  }, [components.Hyperstructure]);

  const handleUpdatePoints = async () => {
    setIsUpdatePointsLoading(true);
    LeaderboardManager.instance(components).updatePoints();
    setPlayersByRank(LeaderboardManager.instance(components).playersByRank);
    setIsUpdatePointsLoading(false);
  };

  const claimConstructionPoints = async () => {
    setIsRegisterLoading(true);
    try {
      await claim_construction_points({
        signer: account,
        hyperstructure_ids: hyperstructuresEntityIds,
        player: ContractAddress(account.address),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const claimSharePoints = async () => {
    setIsSharePointsLoading(true);
    try {
      await claim_share_points({
        signer: account,
        hyperstructure_ids: hyperstructuresEntityIds,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSharePointsLoading(false);
    }
  };

  useEffect(() => {
    setPlayerInfo(getPlayerInfo(players, ContractAddress(account.address), playersByRank, components));
    setIsLoading(false);
  }, [playersByRank]);

  const viewGuildMembers = (guildEntityId: ContractAddress) => {
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
        component: <PlayersPanel players={playerInfo} viewPlayerInfo={viewPlayerInfo} />,
        expandedContent: <PlayerId selectedPlayer={selectedPlayer} />,
      },
      {
        key: "Tribes",
        label: <div>Tribes</div>,
        component: <Guilds players={playerInfo} viewGuildMembers={viewGuildMembers} />,
        expandedContent: selectedPlayer ? (
          <PlayerId selectedPlayer={selectedPlayer} selectedGuild={selectedGuild} back={() => viewPlayerInfo(0n)} />
        ) : (
          <GuildMembers
            players={playerInfo}
            selectedGuildEntityId={selectedGuild}
            viewPlayerInfo={viewPlayerInfo}
            setIsExpanded={setIsExpanded}
          />
        ),
      },
    ],
    [selectedTab, isExpanded, selectedGuild, selectedPlayer, playerInfo],
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

        <div className="flex justify-center gap-8 mt-8">
          <EndSeasonButton />
          <Button
            isLoading={isRegisterLoading || isSharePointsLoading}
            variant="secondary"
            onClick={() => {
              claimConstructionPoints();
              claimSharePoints();
            }}
          >
            Claim All Points
          </Button>
          <Button isLoading={isUpdatePointsLoading} variant="secondary" onClick={handleUpdatePoints}>
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
