import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useSyncLeaderboard } from "@/hooks/helpers/use-sync";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  filterPlayersByBlitzSettlement,
  useBlitzSettlementPlayerAddresses,
} from "@/services/blitz/blitz-settlement-players";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { PrizePanel } from "@/ui/features/prize";
import { BlitzMMRTable } from "@/ui/features/prize/components/blitz-mmr-table";
import { FaithLeaderboardPanel } from "../faith";
import { GuildMembers } from "../guilds/guild-members";
import { Guilds } from "../guilds/guilds";
import { PlayersPanel } from "../player/players-panel";
import { leaderboard } from "@/ui/features/world";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { belongsToActiveGame, getPlayerInfo, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo, usePlayers } from "@bibliothecadao/react";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { Shapes, Sparkles, TrendingUp, Users } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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

export const Social = () => {
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

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(leaderboard));
  const mode = useGameModeConfig();
  const resolvedWorldMode = useResolvedWorldGameMode();
  const isBlitzMode = resolvedWorldMode === "blitz";
  const isEternumMode = resolvedWorldMode === "eternum";
  const showGuildsTab = isEternumMode && mode.ui.showGuildsTab;

  const allPlayers = usePlayers();
  const blitzSettlementPlayerAddresses = useBlitzSettlementPlayerAddresses(components);
  const players = useMemo(
    () => (isBlitzMode ? filterPlayersByBlitzSettlement(allPlayers, blitzSettlementPlayerAddresses) : allPlayers),
    [allPlayers, blitzSettlementPlayerAddresses, isBlitzMode],
  );

  // Check if MMR is enabled
  // s2: mmr config lives on the ChainConfig singleton.
  const chainCfgEntities = useEntityQuery([Has(components.ChainConfig)]);
  const mmrEnabled = useMemo(() => {
    const chainCfg = chainCfgEntities[0] ? getComponentValue(components.ChainConfig, chainCfgEntities[0]) : undefined;
    return Boolean(chainCfg?.mmr_config?.enabled);
  }, [chainCfgEntities, components.ChainConfig]);

  // The Blitz Prize tab is honest only when the chain actually runs prize
  // infrastructure: ChainConfig's fee/entry token addresses are zero on chains
  // without a pot (W6 wires the real appchain prize flow).
  const hasPrizeInfra = useMemo(() => {
    const chainCfg = chainCfgEntities[0] ? getComponentValue(components.ChainConfig, chainCfgEntities[0]) : undefined;
    const feeToken = (chainCfg?.fee_token as unknown as bigint | undefined) ?? 0n;
    const entryToken = (chainCfg?.entry_token_address as unknown as bigint | undefined) ?? 0n;
    return feeToken !== 0n || entryToken !== 0n;
  }, [chainCfgEntities, components.ChainConfig]);

  const structureEntities = useEntityQuery([Has(components.Structure)]);
  const playerStructureCountsMap = useMemo(
    () =>
      structureEntities.reduce<Map<bigint, PlayerStructureCounts>>((countsByOwner, entity) => {
        const structure = getComponentValue(components.Structure, entity);
        if (!structure || !belongsToActiveGame(structure)) return countsByOwner;

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
      }, new Map()),
    [components.Structure, structureEntities],
  );

  useEffect(() => {
    if (!isOpen) return;

    // update first time - initialize with interval on first call
    const manager = LeaderboardManager.instance(components, LEADERBOARD_UPDATE_INTERVAL);
    manager.initialize();
    setPlayersByRank(manager.playersByRank);
  }, [components, isOpen, setPlayersByRank]);

  // Add periodic updates every 1 minute to refresh unregistered shareholder points
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const manager = LeaderboardManager.instance(components);
      manager.updatePoints();
      setPlayersByRank(manager.playersByRank);
    }, LEADERBOARD_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [components, isOpen, setPlayersByRank]);

  useEffect(() => {
    if (!isOpen) return;

    setPlayerInfo(
      getPlayerInfo(players, ContractAddress(account.address), playersByRank, playerStructureCountsMap, components),
    );
  }, [players, account.address, playersByRank, playerStructureCountsMap, components, isOpen, setPlayerInfo]);

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

    if (isBlitzMode && hasPrizeInfra) {
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

    if (isBlitzMode && mmrEnabled) {
      baseTabs.push({
        key: "Blitz MMR",
        label: (
          <div className="flex items-center gap-2">
            <TrendingUp size={16} />
            <span>MMR</span>
          </div>
        ),
        component: (
          <div className="flex flex-col gap-3 p-5">
            <div className="rounded-xl border border-gold/15 bg-black/30 p-4">
              <BlitzMMRTable />
            </div>
            <div className="text-xs text-gold/70">
              Submit rankings from the Blitz Prize tab to trigger MMR updates, and retry there if the first attempt
              fails.
            </div>
          </div>
        ),
        expandedContent: null,
      });
    }

    return baseTabs;
  }, [
    showGuildsTab,
    isEternumMode,
    isBlitzMode,
    hasPrizeInfra,
    selectedGuild,
    selectedPlayer,
    playerInfo,
    viewPlayerInfo,
    viewGuildMembers,
    setIsExpanded,
    mmrEnabled,
  ]);

  const tabsLength = tabs.length;
  const activeTabIndex = Math.max(0, Math.min(selectedTab, tabsLength - 1));
  const { isSyncing } = useSyncLeaderboard({ auto: isOpen, skip: !isOpen });

  useEffect(() => {
    if (tabsLength > 0 && activeTabIndex !== selectedTab) {
      setSelectedTab(activeTabIndex);
    }
  }, [activeTabIndex, selectedTab, setSelectedTab, tabsLength]);

  if (!isOpen) return null;

  return (
    <CenteredModalShell
      title={leaderboard}
      onClose={() => togglePopup(leaderboard)}
      persistKey={leaderboard}
      panelClassName={`h-[760px] max-h-[calc(100vh-64px)] max-w-[calc(100vw-48px)] ${
        isExpanded ? "w-[1500px]" : "w-[1100px]"
      }`}
      bodyClassName="flex overflow-hidden"
    >
      <div className="flex-1 min-w-0 overflow-hidden">
        {isSyncing ? (
          <LoadingAnimation />
        ) : (
          <Tabs
            size="small"
            selectedIndex={activeTabIndex}
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

              <Tabs.Panels className="overflow-hidden flex-1">
                {tabs.map((tab) => (
                  <Tabs.Panel key={tab.key} className="h-full">
                    {tab.component}
                  </Tabs.Panel>
                ))}
              </Tabs.Panels>
            </div>
          </Tabs>
        )}
      </div>
      {isExpanded && (
        <div className="w-[400px] shrink-0 overflow-auto border-l border-gold/15">
          {tabs[activeTabIndex]?.expandedContent ?? null}
        </div>
      )}
    </CenteredModalShell>
  );
};
