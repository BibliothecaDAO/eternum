import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import {
  type PlayerActivityBreakdown,
  type PlayerLeaderboardActivityEntry,
} from "@/services/leaderboard/player-activity-breakdown-service";
import { EndSeasonButton } from "../components/end-season-button";
import { PlayerList, type PlayerCustom } from "./player-list";
import { normalizeLeaderboardAddress } from "./finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "./use-in-game-leaderboard";
import { useMmrForecast } from "./mmr-forecast";
import { configManager, getGuildFromPlayerAddress, isViewerOwner } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { createEmptyActivityBreakdown } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress, PlayerInfo, samePoints } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

const buildActivityBreakdownLookup = (entries: PlayerLeaderboardActivityEntry[]) =>
  new Map(entries.map((entry) => [normalizeLeaderboardAddress(entry.address), entry.activityBreakdown]));

/**
 * Herald's breakdown is history, read at some confirmed head; the standing is the native store now. The row shows the
 * breakdown only when it adds up to exactly the points the standing has registered, so a row's columns and its Points
 * are always one snapshot. Until history catches up (after an award or a checkpoint), the row has no breakdown.
 */
const breakdownOfStanding = (
  breakdown: PlayerActivityBreakdown | undefined,
  registeredPoints: number | undefined,
): PlayerActivityBreakdown | null => {
  if (!breakdown || registeredPoints === undefined) return null;
  const points = Object.values(breakdown).reduce((sum, activity) => sum + activity.points, 0);
  return samePoints(points, registeredPoints) ? breakdown : null;
};

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

  const facts = useNativeFacts(["Structure", "Guild", "GuildMember", "GuildWhitelist"]);

  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address), store);
  const { isFinalized, standingsByAddress } = useInGameLeaderboard();
  const mmr = useMmrForecast(standingsByAddress);

  const [isLoading, setIsLoading] = useState(false);
  const { data: activityEntries, error: activityError } = useLeaderboardActivity();
  const activityBreakdownsByAddress = useMemo(
    () => (activityEntries ? buildActivityBreakdownLookup(activityEntries) : null),
    [activityEntries],
  );
  const mode = useGameModeConfig();

  const leaderboardPlayers: PlayerCustom[] = useMemo(() => {
    const leaderboardPlayers = players
      // filter out players with no address
      .filter((player) => player.address !== 0n)
      .map((player) => {
        const guild = getGuildFromPlayerAddress(player.address, facts.store);

        const isInvited = userGuild
          ? (facts.store.get("GuildWhitelist", {
              game_id: configManager.getActiveGameId(),
              guild_id: userGuild.entityId,
              player: player.address,
            })?.allowed ?? false)
          : false;
        const standing = standingsByAddress.get(normalizeLeaderboardAddress(player.address));
        // Once Herald has answered, a player without an entry has registered nothing yet.
        const breakdown = activityBreakdownsByAddress
          ? (activityBreakdownsByAddress.get(normalizeLeaderboardAddress(player.address)) ??
            createEmptyActivityBreakdown())
          : undefined;

        // Finalized games rank by the on-chain final standings; live games by the native facts.store's standing: registered
        // points plus the hold points accruing since each hyperstructure's last checkpoint. The row's columns are the
        // registered points by activity with those accruing hold points under HS held, so Points is their sum.
        const liveRank = standing?.rank ?? player.rank;
        const livePoints = standing?.points ?? player.points;
        const rank = isFinalized ? (standing?.rank ?? Number.MAX_SAFE_INTEGER) : liveRank;
        const points = isFinalized ? (standing?.points ?? null) : livePoints;

        return {
          ...player,
          isUser: isViewerOwner(player.address, ContractAddress(account.address)),
          points,
          rank,
          isInvited,
          guild,
          activityBreakdown: breakdownOfStanding(breakdown, standing?.registeredPoints),
          accruingHoldPoints: standing?.accruingHoldPoints ?? 0,
          mmrDelta:
            mmr.status === "ready"
              ? (mmr.deltaByAccount.get(normalizeLeaderboardAddress(player.address)) ?? null)
              : null,
        };
      });
    return leaderboardPlayers;
  }, [facts, account.address, activityBreakdownsByAddress, isFinalized, mmr, players, standingsByAddress, userGuild]);

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
    <div className="flex flex-col p-2">
      {activityError && (
        <p role="alert" className="mb-2 text-hud-body text-hud-bad">
          Points breakdown is unavailable. It is read again when points change.
        </p>
      )}
      {mode.ui.showEndSeasonButton && <EndSeasonButton className="mb-2 w-full" />}
      <PlayerList
        players={leaderboardPlayers}
        grants={configManager.getVictoryPointGrants()}
        mmr={mmr.status}
        focusOwnPlayer={focusOwnPlayer}
        viewPlayerInfo={viewPlayerInfo}
        whitelistPlayer={whitelistPlayer}
        isLoading={isLoading}
      />
    </div>
  );
};
