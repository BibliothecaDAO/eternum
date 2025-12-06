import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import TextInput from "@/ui/design-system/atoms/text-input";
import type { LandingLeaderboardEntry } from "@/ui/features/landing/lib/landing-leaderboard-service";
import {
  MIN_REFRESH_INTERVAL_MS,
  useLandingLeaderboardStore,
} from "@/ui/features/landing/lib/use-landing-leaderboard-store";
import { VICTORY_POINT_VALUES, formatHyperstructureControlVpRange } from "@/config/victory-points";
import { EndSeasonButton, PlayerCustom, PlayerList, RegisterPointsButton } from "@/ui/features/social";
import { getEntityIdFromKeys, normalizeDiacriticalMarks } from "@/ui/utils/utils";
import { getGuildFromPlayerAddress, getIsBlitz, getStructureName, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";

// TODO: big limit for now, we need to paginate this
const SOCIAL_LEADERBOARD_LIMIT = 1000;

const normalizeAddress = (address: bigint | string): string => {
  return toHexString(typeof address === "string" ? BigInt(address) : address)
    .toLowerCase()
    .padStart(66, "0");
};

export const PlayersPanel = ({
  players,
  viewPlayerInfo,
}: {
  players: PlayerInfo[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
}) => {
  const {
    setup: {
      components,
      systemCalls: { update_whitelist },
    },
    account: { account },
  } = useDojo();

  const { Structure, GuildWhitelist } = components;

  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address), components);

  const leaderboardEntries = useLandingLeaderboardStore((state) => state.entries);
  const fetchLeaderboardEntries = useLandingLeaderboardStore((state) => state.fetchLeaderboard);
  const lastLeaderboardFetchAt = useLandingLeaderboardStore((state) => state.lastFetchAt);
  const isLeaderboardFetching = useLandingLeaderboardStore((state) => state.isFetching);

  const [refreshCooldownMs, setRefreshCooldownMs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const seasonWinner = useUIStore((state) => state.gameWinner);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue]);

  useEffect(() => {
    const updateCooldown = () => {
      if (!lastLeaderboardFetchAt) {
        setRefreshCooldownMs(0);
        return;
      }

      const elapsed = Date.now() - lastLeaderboardFetchAt;
      const remaining = Math.max(0, MIN_REFRESH_INTERVAL_MS - elapsed);
      setRefreshCooldownMs(remaining);
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 250);

    return () => window.clearInterval(interval);
  }, [lastLeaderboardFetchAt]);

  useEffect(() => {
    void fetchLeaderboardEntries({ limit: SOCIAL_LEADERBOARD_LIMIT });
  }, [fetchLeaderboardEntries]);

  const playersWithStructures: PlayerCustom[] = useMemo(() => {
    // Sort players by points in descending order
    const sortedPlayers = [...players].sort((a, b) => (b.points || 0) - (a.points || 0));

    const playersWithStructures = sortedPlayers
      // filter out players with no address
      .filter((player) => player.address !== 0n)
      .map((player, index) => {
        const structuresEntityIds = runQuery([HasValue(Structure, { owner: ContractAddress(player.address) })]);
        const structures = Array.from(structuresEntityIds)
          .map((entityId) => {
            const structure = getComponentValue(Structure, entityId);
            if (!structure) return undefined;

            return getStructureName(structure, getIsBlitz()).name;
          })
          .filter((structure): structure is string => structure !== undefined);

        const guild = getGuildFromPlayerAddress(player.address, components);

        let isInvited = false;
        if (userGuild) {
          isInvited =
            getComponentValue(GuildWhitelist, getEntityIdFromKeys([player.address, BigInt(userGuild?.entityId)]))
              ?.whitelisted ?? false;
        }
        return {
          ...player,
          structures,
          isUser: player.address === ContractAddress(account.address),
          points: player.points || 0,
          rank: index + 1,
          isInvited,
          guild,
        };
      });
    return playersWithStructures;
  }, [isLoading, players, components, account.address]);

  const leaderboardEntryMap = useMemo(() => {
    const map = new Map<string, LandingLeaderboardEntry>();

    leaderboardEntries.forEach((entry) => {
      console.log("setting for address", entry.address.toLowerCase(), "name", entry.displayName);
      map.set(normalizeAddress(entry.address), entry);
    });

    return map;
  }, [leaderboardEntries]);

  const playersWithLeaderboardStats = useMemo(() => {
    return playersWithStructures.map((player) => {
      const normalizedAddress = normalizeAddress(player.address);
      console.log("getting for address", normalizedAddress);
      const entry = leaderboardEntryMap.get(normalizedAddress) ?? null;

      return {
        ...player,
        leaderboardEntry: entry,
      };
    });
  }, [playersWithStructures, leaderboardEntryMap]);

  const filteredPlayers = useMemo(() => {
    const normalizedTerm = normalizeDiacriticalMarks(searchTerm.toLowerCase());

    let filteredList = playersWithLeaderboardStats;

    if (searchTerm !== "") {
      filteredList = filteredList.filter((player) => {
        const nameMatch = normalizeDiacriticalMarks(player.name.toLowerCase()).includes(normalizedTerm);
        if (nameMatch) return true;

        const addressMatch = normalizeAddress(player.address).includes(normalizedTerm);
        if (addressMatch) return true;

        return player.structures.some(
          (structure) => structure && normalizeDiacriticalMarks(structure.toLowerCase()).includes(normalizedTerm),
        );
      });
    }

    return filteredList;
  }, [playersWithLeaderboardStats, searchTerm]);

  const isRefreshingLeaderboard = isLeaderboardFetching;
  const isCooldownActive = refreshCooldownMs > 0;
  const refreshSecondsLeft = Math.ceil(refreshCooldownMs / 1000);

  const handleRefreshLeaderboard = useCallback(() => {
    if (isRefreshingLeaderboard || isCooldownActive) {
      return;
    }

    void fetchLeaderboardEntries({ limit: SOCIAL_LEADERBOARD_LIMIT, force: true });
  }, [fetchLeaderboardEntries, isRefreshingLeaderboard, isCooldownActive]);

  const whitelistPlayer = (address: ContractAddress) => {
    setIsLoading(true);
    update_whitelist({
      address,
      whitelist: true,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const handleSearch = () => {
    setSearchTerm(inputValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col min-h-72 p-2 h-full w-full overflow-hidden">
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <TextInput
              placeholder="Search players/realms/structures..."
              onChange={(value) => setInputValue(value)}
              onKeyDown={handleKeyDown}
              className="flex-1 button-wood"
            />
            <Button onClick={handleSearch} variant="primary" className="flex items-center gap-1 px-4">
              <Search size={14} />
              <span>Search</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.16em] text-gold/70">
            {isRefreshingLeaderboard ? (
              <span aria-live="polite">Refreshing…</span>
            ) : isCooldownActive ? (
              <span aria-live="polite">Wait {refreshSecondsLeft}s</span>
            ) : null}
            <RefreshButton
              onClick={handleRefreshLeaderboard}
              isLoading={isRefreshingLeaderboard}
              disabled={isRefreshingLeaderboard || isCooldownActive}
              size="md"
              aria-label="Refresh leaderboard"
            />
          </div>
        </div>

        {userGuild?.isOwner && (
          <div className="flex justify-between items-center">
            <div className="text-sm text-gold/80">
              {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} found
            </div>
          </div>
        )}
        <>
          <button
            onClick={() => setShowPointsBreakdown(!showPointsBreakdown)}
            className="bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5 rounded-lg p-3 mb-3 border border-gold/20 hover:border-gold/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-gold font-semibold text-sm">Points Breakdown</span>
              {showPointsBreakdown ? (
                <ChevronUp size={16} className="text-gold" />
              ) : (
                <ChevronDown size={16} className="text-gold" />
              )}
            </div>
          </button>
          {showPointsBreakdown && (
            <div className="bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5 rounded-lg p-3 mb-3 border border-gold/20">
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gold/50">Explore a tile</span>
                  <span className="text-gold font-semibold">{VICTORY_POINT_VALUES.exploreTile} VP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gold/50">Claim an Essence Rift or Camp from bandits</span>
                  <span className="text-gold font-semibold">
                    {VICTORY_POINT_VALUES.claimWorldStructureFromBandits} VP
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gold/50">Claim a Hyperstructure from bandits</span>
                  <span className="text-gold font-semibold">
                    {VICTORY_POINT_VALUES.claimHyperstructureFromBandits} VP
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gold/50">Open a Relic Crest</span>
                  <span className="text-gold font-semibold">{VICTORY_POINT_VALUES.openRelicChest} VP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gold/50">
                    Control a Hyperstructure (1 point per realm settled in 8 tile radius)
                  </span>
                  <span className="text-gold font-semibold">{formatHyperstructureControlVpRange()}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-center">
            <RegisterPointsButton className="flex-1" />
            {!getIsBlitz() && <EndSeasonButton className="flex-1" />}
          </div>
        </>
      </div>

      <div className="flex-1 min-h-0">
        <PlayerList
          players={filteredPlayers}
          viewPlayerInfo={viewPlayerInfo}
          whitelistPlayer={whitelistPlayer}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
