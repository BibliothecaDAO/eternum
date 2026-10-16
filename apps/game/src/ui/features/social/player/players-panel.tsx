import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { type PlayerLeaderboardActivityEntry } from "@/services/leaderboard/player-activity-breakdown-service";
import { EndSeasonButton } from "../components/end-season-button";
import { PlayerList, type PlayerCustom } from "./player-list";
import { normalizeLeaderboardAddress } from "./finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "./use-in-game-leaderboard";
import { configManager, getGuildFromPlayerAddress, isViewerOwner } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, BANDITS_NAME, PlayerInfo } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

const buildActivityBreakdownLookup = (entries: PlayerLeaderboardActivityEntry[]) =>
  new Map(entries.map((entry) => [normalizeLeaderboardAddress(entry.address), entry]));

export const PlayersPanel = ({
  players,
  viewPlayerInfo,
  focusOwnPlayer = false,
}: {
  players: PlayerInfo[];
  focusOwnPlayer?: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
}) => {
  const {
    setup: {
      store,
      systemCalls: { update_whitelist },
    },
    account: { account },
  } = useGame();

  const revision = useNativeRevision(["Structure", "Guild", "GuildMember", "GuildWhitelist"]);

  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address), store);
  const { isFinalized, standingsByAddress } = useInGameLeaderboard();

  const [isLoading, setIsLoading] = useState(false);
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const grants = configManager.getVictoryPointGrants();
  const { data: activityEntries, error: activityError } = useLeaderboardActivity();
  const activityBreakdownsByAddress = useMemo(
    () => buildActivityBreakdownLookup(activityEntries ?? []),
    [activityEntries],
  );
  const mode = useGameModeConfig();

  const leaderboardPlayers: PlayerCustom[] = useMemo(() => {
    const leaderboardPlayers = players
      // filter out players with no address
      .filter((player) => player.address !== 0n)
      .map((player) => {
        const guild = getGuildFromPlayerAddress(player.address, store);

        const isInvited = userGuild
          ? (store.get("GuildWhitelist", {
              game_id: configManager.getActiveGameId(),
              guild_id: userGuild.entityId,
              player: player.address,
            })?.allowed ?? false)
          : false;
        const standing = standingsByAddress.get(normalizeLeaderboardAddress(player.address));
        const activityEntry = activityBreakdownsByAddress.get(normalizeLeaderboardAddress(player.address)) ?? null;

        // Finalized games rank by the on-chain final standings. Live games rank
        // by Herald’s prepared history total — the same source as the breakdown
        // columns, so POINTS is always the sum of what the row displays (owner
        // ruling). The native store standing is only the pre-fetch fallback.
        const liveRank = standing?.rank ?? player.rank;
        const livePoints = standing?.points ?? player.points;
        const rank = isFinalized ? (standing?.rank ?? Number.MAX_SAFE_INTEGER) : liveRank;
        const points = isFinalized ? (standing?.points ?? null) : livePoints;
        const includesLiveShareholderPoints = isFinalized
          ? false
          : activityEntry
            ? activityEntry.activityBreakdown.hyperstructureShare.points > 0
            : (standing?.includesLiveShareholderPoints ?? false);

        return {
          ...player,
          isUser: isViewerOwner(player.address, ContractAddress(account.address)),
          points,
          rank,
          isInvited,
          guild,
          activityBreakdown: activityEntry?.activityBreakdown ?? null,
          includesLiveShareholderPoints,
        };
      });
    return leaderboardPlayers;
  }, [
    revision,
    account.address,
    activityBreakdownsByAddress,
    store,
    isFinalized,
    players,
    standingsByAddress,
    userGuild,
  ]);

  const whitelistPlayer = (address: ContractAddress) => {
    if (!canIssueOrders()) return;
    setIsLoading(true);
    update_whitelist({
      address,
      whitelist: true,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col min-h-72 p-2 h-full w-full overflow-hidden">
      <div className="flex flex-col gap-2 mb-4">
        {activityError && (
          <p role="alert" className="text-sm text-danger">
            Points breakdown is unavailable. It is read again when points change.
          </p>
        )}
        <>
          <div className="mb-3 overflow-hidden rounded-lg border border-gold/20 bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5">
            <button
              onClick={() => setShowPointsBreakdown(!showPointsBreakdown)}
              className="flex w-full items-center justify-between p-3 transition-colors cursor-pointer hover:bg-gold/5"
            >
              <span className="text-gold font-semibold text-sm">Points Breakdown</span>
              {showPointsBreakdown ? (
                <SemanticIcon name="chevron-up" size={16} className="text-gold" />
              ) : (
                <SemanticIcon name="chevron-down" size={16} className="text-gold" />
              )}
            </button>
            {showPointsBreakdown && (
              <div className="border-t border-gold/15 px-3 pb-3 pt-2">
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Explore a tile</span>
                    <span className="text-gold font-semibold">{grants.exploreTile} VP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Claim an Essence Rift or Camp from {BANDITS_NAME}</span>
                    <span className="text-gold font-semibold">{grants.claimCampFromBandits} VP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Claim a Hyperstructure from {BANDITS_NAME}</span>
                    <span className="text-gold font-semibold">{grants.claimHyperstructureFromBandits} VP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Open a Relic Crate</span>
                    <span className="text-gold font-semibold">{grants.openRelicCrate} VP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gold/50">Control a Hyperstructure, per realm settled within 8 tiles</span>
                    <span className="text-gold font-semibold">{grants.hyperstructurePerRealmPerSecond} VP/s</span>
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
          players={leaderboardPlayers}
          focusOwnPlayer={focusOwnPlayer}
          viewPlayerInfo={viewPlayerInfo}
          whitelistPlayer={whitelistPlayer}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
