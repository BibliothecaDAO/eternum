import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import Button from "@/ui/design-system/atoms/button";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import TextInput from "@/ui/design-system/atoms/text-input";
import type { LandingLeaderboardEntry } from "@/services/leaderboard/landing-leaderboard-service";
import { useLandingLeaderboardStore } from "@/services/leaderboard/use-landing-leaderboard-store";
import { VICTORY_POINT_VALUES, formatHyperstructureControlVpRange } from "@/config/victory-points";
import { EndSeasonButton } from "../components/end-season-button";
import { PlayerList, type PlayerCustom } from "./player-list";
import {
  buildFinalizedBlitzStandingLookup,
  buildRegisteredPointsLookup,
  normalizeLeaderboardAddress,
  resolveFinalizedBlitzStanding,
} from "./finalized-blitz-leaderboard";
import { getEntityIdFromKeys, normalizeDiacriticalMarks } from "@/ui/utils/utils";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, BANDITS_NAME, PlayerInfo } from "@bibliothecadao/types";
import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { useEntityQuery } from "@dojoengine/react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Search from "lucide-react/dist/esm/icons/search";
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";

// TODO: big limit for now, we need to paginate this
const SOCIAL_LEADERBOARD_LIMIT = 1000;

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
  const resolvedWorldMode = useResolvedWorldGameMode();
  const isBlitzMode = resolvedWorldMode === "blitz";

  const leaderboardEntries = useLandingLeaderboardStore((state) => state.entries);
  const fetchLeaderboardEntries = useLandingLeaderboardStore((state) => state.fetchLeaderboard);
  const isLeaderboardFetching = useLandingLeaderboardStore((state) => state.isFetching);

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const mode = useGameModeConfig();
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const playerRankEntities = useEntityQuery([Has(components.PlayerRank)]);
  const registeredPointsEntities = useEntityQuery([Has(components.PlayerRegisteredPoints)]);

  const finalTrialId = useMemo(() => {
    const finalTrial = finalEntities[0] ? getComponentValue(components.PlayersRankFinal, finalEntities[0]) : undefined;
    return finalTrial?.trial_id as bigint | undefined;
  }, [components.PlayersRankFinal, finalEntities]);

  const registeredPointsLookup = useMemo(() => {
    const registeredPointRows = registeredPointsEntities
      .map((entityId) => getComponentValue(components.PlayerRegisteredPoints, entityId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        address: row.address as unknown as bigint,
        registeredPoints: row.registered_points as bigint,
      }));

    return buildRegisteredPointsLookup(registeredPointRows);
  }, [components.PlayerRegisteredPoints, registeredPointsEntities]);

  const finalizedBlitzStandingLookup = useMemo(() => {
    if (!isBlitzMode) {
      return new Map();
    }

    const playerRankRows = playerRankEntities
      .map((entityId) => getComponentValue(components.PlayerRank, entityId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        playerAddress: row.player as unknown as bigint,
        rank: row.rank as bigint | number,
        trialId: row.trial_id as bigint,
      }));

    return buildFinalizedBlitzStandingLookup(playerRankRows, finalTrialId, registeredPointsLookup);
  }, [components.PlayerRank, finalTrialId, isBlitzMode, playerRankEntities, registeredPointsLookup]);

  const shouldUseFinalizedBlitzStandings = isBlitzMode && finalizedBlitzStandingLookup.size > 0;

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue]);

  useEffect(() => {
    // Fetch once on open for immediate data. The shared 60s polling that keeps
    // this in sync with the top-bar rank pill is driven by the always-mounted
    // TopHeader (both read the same store `entries`); the manual refresh button
    // below still forces an immediate update.
    void fetchLeaderboardEntries({ limit: SOCIAL_LEADERBOARD_LIMIT });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playersWithStructures: PlayerCustom[] = useMemo(() => {
    // Sort players by points in descending order
    const sortedPlayers = players.toSorted((a, b) => (b.points || 0) - (a.points || 0));

    const playersWithStructures = sortedPlayers
      // filter out players with no address
      .filter((player) => player.address !== 0n)
      .map((player, index) => {
        const structuresEntityIds = runQuery([HasValue(Structure, { owner: ContractAddress(player.address) })]);
        const structures = Array.from(structuresEntityIds)
          .map((entityId) => {
            const structure = getComponentValue(Structure, entityId);
            if (!structure) return undefined;

            return mode.structure.getName(structure).name;
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
  }, [GuildWhitelist, Structure, account.address, components, mode, players, userGuild]);

  const leaderboardEntryMap = useMemo(() => {
    const map = new Map<string, LandingLeaderboardEntry>();

    leaderboardEntries.forEach((entry) => {
      map.set(normalizeLeaderboardAddress(entry.address), entry);
    });

    return map;
  }, [leaderboardEntries]);

  const playersWithLeaderboardStats = useMemo(() => {
    return playersWithStructures.map((player) => {
      const normalizedAddress = normalizeLeaderboardAddress(player.address);
      const entry = leaderboardEntryMap.get(normalizedAddress) ?? null;
      const finalizedStanding = finalizedBlitzStandingLookup.get(normalizedAddress) ?? null;
      // Prize claims follow the finalized registered-point ranking, so the in-game list
      // needs to stop using live shareholder accrual once that ranking exists.
      const resolvedStanding = resolveFinalizedBlitzStanding(finalizedStanding, shouldUseFinalizedBlitzStandings);

      return {
        ...player,
        leaderboardEntry: entry,
        leaderboardRankOverride: resolvedStanding?.rankOverride,
        leaderboardPointsOverride: resolvedStanding?.pointsOverride,
        includesLiveShareholderPoints:
          resolvedStanding?.includesLiveShareholderPoints ?? Boolean(entry?.unregisteredPoints),
      };
    });
  }, [finalizedBlitzStandingLookup, leaderboardEntryMap, playersWithStructures, shouldUseFinalizedBlitzStandings]);

  const filteredPlayers = useMemo(() => {
    const normalizedTerm = normalizeDiacriticalMarks(searchTerm.toLowerCase());

    let filteredList = playersWithLeaderboardStats;

    if (searchTerm !== "") {
      filteredList = filteredList.filter((player) => {
        const nameMatch = normalizeDiacriticalMarks(player.name.toLowerCase()).includes(normalizedTerm);
        if (nameMatch) return true;

        const addressMatch = normalizeLeaderboardAddress(player.address).includes(normalizedTerm);
        if (addressMatch) return true;

        return player.structures.some(
          (structure) => structure && normalizeDiacriticalMarks(structure.toLowerCase()).includes(normalizedTerm),
        );
      });
    }

    return filteredList;
  }, [playersWithLeaderboardStats, searchTerm]);

  const isRefreshingLeaderboard = isLeaderboardFetching;

  const handleRefreshLeaderboard = useCallback(() => {
    if (isRefreshingLeaderboard) {
      return;
    }

    void fetchLeaderboardEntries({ limit: SOCIAL_LEADERBOARD_LIMIT, force: true });
  }, [fetchLeaderboardEntries, isRefreshingLeaderboard]);

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
              className="flex-1 btn-bronze"
            />
            <Button onClick={handleSearch} variant="primary" className="flex items-center gap-1 px-4">
              <Search size={14} />
              <span>Search</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton
              onClick={handleRefreshLeaderboard}
              isLoading={isRefreshingLeaderboard}
              disabled={isRefreshingLeaderboard}
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
          <div className="mb-3 overflow-hidden rounded-lg border border-gold/20 bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5">
            <button
              onClick={() => setShowPointsBreakdown(!showPointsBreakdown)}
              className="flex w-full items-center justify-between p-3 transition-colors cursor-pointer hover:bg-gold/5"
            >
              <span className="text-gold font-semibold text-sm">Points Breakdown</span>
              {showPointsBreakdown ? (
                <ChevronUp size={16} className="text-gold" />
              ) : (
                <ChevronDown size={16} className="text-gold" />
              )}
            </button>
            {showPointsBreakdown && (
              <div className="border-t border-gold/15 px-3 pb-3 pt-2">
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Explore a tile</span>
                    <span className="text-gold font-semibold">{VICTORY_POINT_VALUES.exploreTile} VP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Claim an Essence Rift or Camp from {BANDITS_NAME}</span>
                    <span className="text-gold font-semibold">
                      {VICTORY_POINT_VALUES.claimWorldStructureFromBandits} VP
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Claim a Hyperstructure from {BANDITS_NAME}</span>
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
          </div>
          {mode.ui.showEndSeasonButton && (
            <div className="flex justify-center">
              <EndSeasonButton className="flex-1" />
            </div>
          )}
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
