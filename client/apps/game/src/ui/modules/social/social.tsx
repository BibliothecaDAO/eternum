import { useSyncLeaderboard } from "@/hooks/helpers/use-sync";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { PlayerDataTransformed } from "@/three/managers/player-data-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { social } from "@/ui/components/navigation/config";
import { ExpandableOSWindow } from "@/ui/components/navigation/os-window";
import { GuildMembers } from "@/ui/components/worldmap/guilds/guild-members";
import { Guilds } from "@/ui/components/worldmap/guilds/guilds";
import { PlayersPanel } from "@/ui/components/worldmap/players/players-panel";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { Tabs } from "@/ui/elements/tab";
import { getPlayerInfo, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo, usePlayers } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { Shapes, Users } from "lucide-react";
import { useEffect, useMemo } from "react";
import { PlayerId } from "./player-id";
import { useSocialStore } from "./socialStore";

export const Social = () => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { claim_construction_points, claim_share_points },
    },
  } = useDojo();

  const selectedTab = useSocialStore((state) => state.selectedTab);
  const isExpanded = useSocialStore((state) => state.isExpanded);
  const selectedGuild = useSocialStore((state) => state.selectedGuild);
  const selectedPlayer = useSocialStore((state) => state.selectedPlayer);
  const playersByRank = useSocialStore((state) => state.playersByRank);
  const playerInfo = useSocialStore((state) => state.playerInfo);
  const setSelectedTab = useSocialStore((state) => state.setSelectedTab);
  const setIsExpanded = useSocialStore((state) => state.setIsExpanded);
  const setIsRegisterLoading = useSocialStore((state) => state.setIsRegisterLoading);
  const setIsSharePointsLoading = useSocialStore((state) => state.setIsSharePointsLoading);
  const setIsUpdatePointsLoading = useSocialStore((state) => state.setIsUpdatePointsLoading);
  const setSelectedGuild = useSocialStore((state) => state.setSelectedGuild);
  const setSelectedPlayer = useSocialStore((state) => state.setSelectedPlayer);
  const setPlayersByRank = useSocialStore((state) => state.setPlayersByRank);
  const setPlayerInfo = useSocialStore((state) => state.setPlayerInfo);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(social));

  const players = usePlayers();

  useEffect(() => {
    // update first time - initialize with interval on first call
    const manager = LeaderboardManager.instance(components, LEADERBOARD_UPDATE_INTERVAL);
    manager.initialize();
    setPlayersByRank(manager.playersByRank);
  }, [components, setPlayersByRank]);

  // Add periodic updates every 1 minute to refresh unregistered shareholder points
  useEffect(() => {
    const interval = setInterval(() => {
      const manager = LeaderboardManager.instance(components);
      manager.updatePoints();
      setPlayersByRank(manager.playersByRank);
    }, LEADERBOARD_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [components, setPlayersByRank]);

  useEffect(() => {
    const loadPlayerData = async () => {
      // Create a Map to store address -> structure counts mapping (using bigint keys)
      const playerStructureCountsMap = new Map<
        bigint,
        {
          banks: number;
          mines: number;
          realms: number;
          hyperstructures: number;
          villages: number;
        }
      >();

      const playerStore = usePlayerStore.getState();
      const allPlayersData = await playerStore.getAllPlayersData();

      if (allPlayersData) {
        allPlayersData.forEach((playerData: PlayerDataTransformed) => {
          playerStructureCountsMap.set(BigInt(playerData.ownerAddress), {
            banks: playerData.bankCount ?? 0,
            mines: playerData.mineCount ?? 0,
            realms: playerData.realmsCount ?? 0,
            hyperstructures: playerData.hyperstructuresCount ?? 0,
            villages: playerData.villageCount ?? 0,
          });
        });
      }

      setPlayerInfo(
        getPlayerInfo(players, ContractAddress(account.address), playersByRank, playerStructureCountsMap, components),
      );
    };

    loadPlayerData();
  }, [players, account.address, playersByRank, components, setPlayerInfo]);

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
        label: (
          <div className="flex items-center gap-2">
            <Users size={16} />
            <span>Players</span>
          </div>
        ),
        component: <PlayersPanel players={playerInfo} viewPlayerInfo={viewPlayerInfo} />,
        expandedContent: <PlayerId selectedPlayer={selectedPlayer} />,
      },
      {
        key: "Tribes",
        label: (
          <div className="flex items-center gap-2">
            <Shapes size={16} />
            <span>Tribes</span>
          </div>
        ),
        component: <Guilds players={playerInfo} viewGuildMembers={viewGuildMembers} />,
        expandedContent: selectedPlayer ? (
          <PlayerId selectedPlayer={selectedPlayer} selectedGuild={selectedGuild} back={() => viewPlayerInfo(0n)} />
        ) : (
          <GuildMembers players={playerInfo} viewPlayerInfo={viewPlayerInfo} setIsExpanded={setIsExpanded} />
        ),
      },
    ],
    [
      selectedTab,
      isExpanded,
      selectedGuild,
      selectedPlayer,
      playerInfo,
      viewPlayerInfo,
      viewGuildMembers,
      setIsExpanded,
    ],
  );

  const SocialContent = () => {
    const { isSyncing } = useSyncLeaderboard();
    return isSyncing ? (
      <LoadingAnimation />
    ) : (
      <Tabs
        size="small"
        selectedIndex={selectedTab}
        onChange={(index: number) => {
          setSelectedTab(index);
          setIsExpanded(false);
          setSelectedPlayer(0n);
        }}
        className="h-full mt-3"
      >
        <div className="flex flex-col h-full">
          <Tabs.List className="">
            {tabs.map((tab) => (
              <Tabs.Tab key={tab.key} className="py-3 px-6 flex items-center justify-center">
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {/* <div className="flex justify-center gap-4 mt-1 mb-3 px-4">
            <Button
              isLoading={isRegisterLoading || isSharePointsLoading}
              variant="gold"
              onClick={() => {
                claimConstructionPoints();
                claimSharePoints();
              }}
              className="flex-1 flex justify-center items-center py-2"
            >
              Claim All Points
            </Button>

            <Button
              isLoading={isUpdatePointsLoading}
              variant="secondary"
              onClick={handleUpdatePoints}
              className="flex items-center gap-1"
            >
              <RefreshCw size={14} />
              Update
            </Button>

            <EndSeasonButton className="flex items-center" />
          </div> */}

          <Tabs.Panels className="overflow-hidden flex-1">
            {tabs.map((tab) => (
              <Tabs.Panel key={tab.key} className="h-full">
                {tab.component}
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </div>
      </Tabs>
    );
  };

  return (
    <ExpandableOSWindow
      width="900px"
      widthExpanded="400px"
      onClick={() => togglePopup(social)}
      show={isOpen}
      title={social}
      hintSection={HintSection.Tribes}
      childrenExpanded={tabs[selectedTab].expandedContent}
      isExpanded={isExpanded}
    >
      {isOpen ? <SocialContent /> : null}
    </ExpandableOSWindow>
  );
};
