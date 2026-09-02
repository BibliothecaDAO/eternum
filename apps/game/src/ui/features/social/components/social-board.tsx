import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useWorldSlicesStore, type WorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { filterPlayersByBlitzSettlement } from "@/services/blitz/blitz-settlement-players";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { PrizePanel } from "@/ui/features/prize";
import { getPlayerInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { Shapes, Sparkles, Users } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo } from "react";
import { FaithLeaderboardPanel } from "../faith";
import { GuildMembers } from "../guilds/guild-members";
import { Guilds } from "../guilds/guilds";
import { PlayersPanel } from "../player/players-panel";
import { useInGameLeaderboard } from "../player/use-in-game-leaderboard";
import { PlayerId } from "./player-id";
import { useSocialStore } from "./use-social-store";

interface SocialTabConfig {
  key: string;
  label: ReactNode;
  component: ReactNode;
  expandedContent: ReactNode;
}

type PlayerStructureCounts = {
  banks: number;
  mines: number;
  realms: number;
  hyperstructures: number;
  villages: number;
};

const countStructuresByOwner = (structures: WorldSlicesStore["structures"]) =>
  structures.reduce<Map<bigint, PlayerStructureCounts>>((countsByOwner, structure) => {
    const counts = countsByOwner.get(structure.owner) ?? {
      banks: 0,
      mines: 0,
      realms: 0,
      hyperstructures: 0,
      villages: 0,
    };
    if (structure.base.category === StructureType.Realm) counts.realms += 1;
    if (structure.base.category === StructureType.Hyperstructure) counts.hyperstructures += 1;
    if (structure.base.category === StructureType.Bank) counts.banks += 1;
    if (structure.base.category === StructureType.FragmentMine) counts.mines += 1;
    if (structure.base.category === StructureType.Village) counts.villages += 1;
    countsByOwner.set(structure.owner, counts);
    return countsByOwner;
  }, new Map());

export const LEADERBOARD_POPOVER_ID = "leaderboard";

/**
 * The social board: players, tribes, faith and prize tabs with the expandable player / tribe detail column. It
 * renders inside the leaderboard button's popover; its world-slice subscriptions exist only while that is open.
 */
export const SocialBoard = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const selectedTab = useSocialStore((state) => state.selectedTab);
  const isExpanded = useSocialStore((state) => state.isExpanded);
  const selectedGuild = useSocialStore((state) => state.selectedGuild);
  const selectedPlayer = useSocialStore((state) => state.selectedPlayer);
  const playersByRank = useSocialStore((state) => state.playersByRank);
  const playerInfo = useSocialStore((state) => state.playerInfo);
  const setSelectedTab = useSocialStore((state) => state.setSelectedTab);
  const setIsExpanded = useSocialStore((state) => state.setIsExpanded);
  const setSelectedGuild = useSocialStore((state) => state.setSelectedGuild);
  const setSelectedPlayer = useSocialStore((state) => state.setSelectedPlayer);
  const setPlayersByRank = useSocialStore((state) => state.setPlayersByRank);
  const setPlayerInfo = useSocialStore((state) => state.setPlayerInfo);

  const mode = useGameModeConfig();
  const resolvedWorldMode = useResolvedWorldGameMode();
  const isBlitzMode = resolvedWorldMode === "blitz";
  const isEternumMode = resolvedWorldMode === "eternum";
  const showGuildsTab = isEternumMode && mode.ui.showGuildsTab;

  // The world slices are the subscription: the bridge publishes each once per ingest slice, already active-game scoped.
  const allPlayers = useWorldSlicesStore((state) => state.players);
  const blitzSettlementPlayerAddresses = useWorldSlicesStore((state) => state.blitzSettlementPlayers);
  const structures = useWorldSlicesStore((state) => state.structures);
  const players = useMemo(
    () => (isBlitzMode ? filterPlayersByBlitzSettlement(allPlayers, blitzSettlementPlayerAddresses) : allPlayers),
    [allPlayers, blitzSettlementPlayerAddresses, isBlitzMode],
  );
  const playerStructureCountsMap = useMemo(() => countStructuresByOwner(structures), [structures]);

  // One leaderboard source: the same standings the identity chip and the players panel read, recomputed on the
  // bridge's leaderboard revision and the coarse tick instead of a private manager interval.
  const { standingsByAddress } = useInGameLeaderboard();
  const rankedPlayers = useMemo(
    () =>
      [...standingsByAddress.values()]
        .toSorted((left, right) => left.rank - right.rank)
        .map((standing): [ContractAddress, number] => [standing.address, standing.points]),
    [standingsByAddress],
  );

  useEffect(() => {
    setPlayersByRank(rankedPlayers);
  }, [rankedPlayers, setPlayersByRank]);

  useEffect(() => {
    setPlayerInfo(
      getPlayerInfo(players, ContractAddress(account.address), playersByRank, playerStructureCountsMap, components),
    );
  }, [players, account.address, playersByRank, playerStructureCountsMap, components, setPlayerInfo]);

  const viewGuildMembers = useCallback(
    (guildEntityId: ContractAddress) => {
      if (selectedGuild === guildEntityId) {
        setSelectedPlayer(0n);
        setIsExpanded(!isExpanded);
      } else {
        setSelectedGuild(guildEntityId);
        setIsExpanded(true);
      }
    },
    [selectedGuild, isExpanded, setSelectedGuild, setSelectedPlayer, setIsExpanded],
  );

  const viewPlayerInfo = useCallback(
    (playerAddress: ContractAddress) => {
      if (selectedPlayer === playerAddress) {
        setIsExpanded(!isExpanded);
      } else {
        setSelectedPlayer(playerAddress);
        setIsExpanded(true);
      }
    },
    [selectedPlayer, isExpanded, setSelectedPlayer, setIsExpanded],
  );

  const tabs = useMemo<SocialTabConfig[]>(() => {
    const baseTabs: SocialTabConfig[] = [
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
    ];

    if (showGuildsTab) {
      baseTabs.push({
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
      });
    }

    if (isEternumMode) {
      baseTabs.push({
        key: "Faith",
        label: (
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <span>Faith</span>
          </div>
        ),
        component: <FaithLeaderboardPanel />,
        expandedContent: null,
      });
    }

    if (isBlitzMode) {
      baseTabs.push({
        key: "Blitz Prize",
        label: (
          <div className="flex items-center gap-2">
            <span>Blitz Prize</span>
          </div>
        ),
        component: <PrizePanel />,
        expandedContent: null,
      });
    }

    return baseTabs;
  }, [
    showGuildsTab,
    isEternumMode,
    isBlitzMode,
    selectedGuild,
    selectedPlayer,
    playerInfo,
    viewPlayerInfo,
    viewGuildMembers,
    setIsExpanded,
  ]);

  const tabsLength = tabs.length;
  const activeTabIndex = Math.max(0, Math.min(selectedTab, tabsLength - 1));
  useEffect(() => {
    if (tabsLength > 0 && activeTabIndex !== selectedTab) {
      setSelectedTab(activeTabIndex);
    }
  }, [activeTabIndex, selectedTab, setSelectedTab, tabsLength]);

  return (
    <div
      className={cn(
        "flex h-[720px] max-h-[calc(100vh-7rem)] max-w-full overflow-hidden",
        isExpanded ? "w-[1400px]" : "w-[1000px]",
      )}
    >
      <div className="flex-1 min-w-0 overflow-hidden">
        <Tabs
          size="small"
          selectedIndex={activeTabIndex}
          onChange={(index: number) => {
            setSelectedTab(index);
            setIsExpanded(false);
            setSelectedPlayer(0n);
          }}
          className="h-full"
        >
          <div className="flex flex-col h-full">
            <Tabs.List className="">
              {tabs.map((tab) => (
                <Tabs.Tab key={tab.key} className="py-3 px-6 flex items-center justify-center">
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            <Tabs.Panels className="overflow-hidden flex-1">
              {tabs.map((tab) => (
                <Tabs.Panel key={tab.key} className="h-full">
                  {tab.component}
                </Tabs.Panel>
              ))}
            </Tabs.Panels>
          </div>
        </Tabs>
      </div>
      {isExpanded && (
        <div className="w-[400px] shrink-0 overflow-auto border-l border-gold/15">
          {tabs[activeTabIndex]?.expandedContent ?? null}
        </div>
      )}
    </div>
  );
};
