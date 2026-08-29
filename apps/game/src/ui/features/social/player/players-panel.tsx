import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import {
  fetchLeaderboardActivityBreakdowns,
  type PlayerLeaderboardActivityEntry,
} from "@/services/leaderboard/player-activity-breakdown-service";
import Button from "@/ui/design-system/atoms/button";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import TextInput from "@/ui/design-system/atoms/text-input";
import { VICTORY_POINT_VALUES, formatHyperstructureControlVpRange } from "@/config/victory-points";
import { EndSeasonButton } from "../components/end-season-button";
import { PlayerList, type PlayerCustom } from "./player-list";
import { normalizeLeaderboardAddress } from "./finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "./use-in-game-leaderboard";
import { getEntityIdFromKeys, normalizeDiacriticalMarks } from "@/ui/utils/utils";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, BANDITS_NAME, PlayerInfo } from "@bibliothecadao/types";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Search from "lucide-react/dist/esm/icons/search";
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { gameEntityKey } from "@/sync/game-scope";
import { useStoryEventRevision } from "@/hooks/store/use-story-events-store";

const SOCIAL_LEADERBOARD_LIMIT = 1000;

const buildActivityBreakdownLookup = (entries: PlayerLeaderboardActivityEntry[]) =>
  new Map(entries.map((entry) => [normalizeLeaderboardAddress(entry.address), entry]));

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
  const { isFinalized, standingsByAddress } = useInGameLeaderboard();

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [activityBreakdownsByAddress, setActivityBreakdownsByAddress] = useState(
    () => new Map<string, PlayerLeaderboardActivityEntry>(),
  );
  const [isActivityBreakdownFetching, setIsActivityBreakdownFetching] = useState(false);
  const mode = useGameModeConfig();
  const storyEventRevision = useStoryEventRevision();

  const refreshActivityBreakdowns = useCallback(async () => {
    setIsActivityBreakdownFetching(true);
    try {
      const entries = await fetchLeaderboardActivityBreakdowns(SOCIAL_LEADERBOARD_LIMIT);
      setActivityBreakdownsByAddress(buildActivityBreakdownLookup(entries));
    } catch (error) {
      console.error("Failed to refresh leaderboard activity breakdown", error);
    } finally {
      setIsActivityBreakdownFetching(false);
    }
  }, []);

  useEffect(() => {
    void refreshActivityBreakdowns();
  }, [refreshActivityBreakdowns, storyEventRevision]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue]);

  const playersWithStructures: PlayerCustom[] = useMemo(() => {
    const playersWithStructures = players
      // filter out players with no address
      .filter((player) => player.address !== 0n)
      .map((player) => {
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
            // GuildWhitelist is keyed (guild_id, address) — guild first.
            getComponentValue(GuildWhitelist, gameEntityKey([BigInt(userGuild?.entityId), player.address]))
              ?.whitelisted ?? false;
        }
        const standing = standingsByAddress.get(normalizeLeaderboardAddress(player.address));
        const activityEntry = activityBreakdownsByAddress.get(normalizeLeaderboardAddress(player.address)) ?? null;

        // Finalized games rank by the on-chain final standings. Live games rank
        // by the SQL leaderboard total — the same source as the breakdown
        // columns, so POINTS is always the sum of what the row displays (owner
        // ruling). The RECS standing is only the pre-fetch fallback.
        const liveRank = activityEntry?.rank ?? standing?.rank ?? player.rank;
        const livePoints = activityEntry?.totalPoints ?? standing?.points ?? player.points;
        const rank = isFinalized ? (standing?.rank ?? Number.MAX_SAFE_INTEGER) : liveRank;
        const points = isFinalized ? (standing?.points ?? 0) : livePoints;
        const includesLiveShareholderPoints = isFinalized
          ? false
          : activityEntry
            ? activityEntry.activityBreakdown.hyperstructureShare.points > 0
            : (standing?.includesLiveShareholderPoints ?? false);

        return {
          ...player,
          structures,
          isUser: player.address === ContractAddress(account.address),
          points,
          rank,
          isInvited,
          guild,
          activityBreakdown: activityEntry?.activityBreakdown ?? null,
          includesLiveShareholderPoints,
        };
      });
    return playersWithStructures;
  }, [
    GuildWhitelist,
    Structure,
    account.address,
    activityBreakdownsByAddress,
    components,
    isFinalized,
    mode,
    players,
    standingsByAddress,
    userGuild,
  ]);

  const filteredPlayers = useMemo(() => {
    const normalizedTerm = normalizeDiacriticalMarks(searchTerm.toLowerCase());

    let filteredList = playersWithStructures;

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
  }, [playersWithStructures, searchTerm]);

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
          <RefreshButton
            onClick={refreshActivityBreakdowns}
            isLoading={isActivityBreakdownFetching}
            disabled={isActivityBreakdownFetching}
            size="md"
            aria-label="Refresh activity breakdown"
          />
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
