import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useFactView } from "@/hooks/use-fact-view";
import { usePlayers } from "@/hooks/use-player-profile";
import { gameStructuresView, settlementPlayersView } from "@/sync/fact-views";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { filterPlayersByBlitzSettlement } from "@/services/blitz/blitz-settlement-players";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudTabs, HudWindow } from "@/ui/design-system/kit/hud-elements";
import "@/ui/features/world/hud/hud.css";
import { getPlayerInfo } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { ContractAddress, StructureType } from "@bibliothecadao/types";

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

const countStructuresByOwner = (structures: NativeRows["Structure"][]) =>
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
    if (structure.base.category === StructureType.Mine) counts.mines += 1;
    if (structure.base.category === StructureType.Village) counts.villages += 1;
    countsByOwner.set(structure.owner, counts);
    return countsByOwner;
  }, new Map());

export const LEADERBOARD_POPOVER_ID = "leaderboard";

/** The leaderboard hangs from the top centre as a HUD window as large as its table and rows, draggable by its bar. */
export const LeaderboardSurface = () => (
  <HudWindow
    title="Leaderboard"
    icon="victory"
    size="fit"
    onClose={() => usePopoverStore.getState().close(LEADERBOARD_POPOVER_ID)}
  >
    <SocialBoard focusOwnPlayer />
  </HudWindow>
);

/**
 * The social board: players, tribes and faith tabs with the expandable player / tribe detail column. It
 * renders inside the identity chip's popover; its world-slice subscriptions exist only while that is open.
 */
const SocialBoard = ({ focusOwnPlayer = false }: { focusOwnPlayer?: boolean }) => {
  const {
    account: { account },
    setup: { store },
  } = useGame();

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
  const allPlayers = usePlayers();
  const blitzSettlementPlayerAddresses = useFactView(settlementPlayersView);
  const structures = useFactView(gameStructuresView);
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
      getPlayerInfo(players, ContractAddress(account.address), playersByRank, playerStructureCountsMap, store),
    );
  }, [players, account.address, playersByRank, playerStructureCountsMap, store, setPlayerInfo]);

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
        component: (
          <PlayersPanel players={playerInfo} viewPlayerInfo={viewPlayerInfo} focusOwnPlayer={focusOwnPlayer} />
        ),
        expandedContent: <PlayerId selectedPlayer={selectedPlayer} />,
      },
    ];

    if (showGuildsTab) {
      baseTabs.push({
        key: "Tribes",
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
        component: <FaithLeaderboardPanel />,
        expandedContent: null,
      });
    }

    return baseTabs;
  }, [
    focusOwnPlayer,
    showGuildsTab,
    isEternumMode,
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
    <div className="flex max-w-full">
      <div className="min-w-0 flex-1">
        {tabsLength === 1 ? (
          tabs[0].component
        ) : (
          <div className="flex h-full flex-col gap-2">
            <HudTabs
              tabs={tabs.map((tab) => ({ key: tab.key, label: tab.key }))}
              value={tabs[activeTabIndex].key}
              onChange={(key) => {
                setSelectedTab(tabs.findIndex((tab) => tab.key === key));
                setIsExpanded(false);
                setSelectedPlayer(0n);
              }}
            />
            <div className="flex-1 overflow-hidden">{tabs[activeTabIndex].component}</div>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className="w-96 shrink-0 border-l border-hud-divider">{tabs[activeTabIndex]?.expandedContent ?? null}</div>
      )}
    </div>
  );
};
