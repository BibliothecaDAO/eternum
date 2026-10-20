import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { type PlayerLeaderboardActivityEntry } from "@/services/leaderboard/player-activity-breakdown-service";
import { EndSeasonButton } from "../components/end-season-button";
import { PlayerList, type PlayerCustom } from "./player-list";
import { normalizeLeaderboardAddress } from "./finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "./use-in-game-leaderboard";
import { useMmrForecast } from "./mmr-forecast";
import { configManager, getGuildFromPlayerAddress, isViewerOwner } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
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
  const mmr = useMmrForecast(standingsByAddress);

  const [isLoading, setIsLoading] = useState(false);
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

        // Finalized games rank by the on-chain final standings; live games by the native store's standing: registered
        // points plus the hold points accruing since each hyperstructure's last checkpoint. The row's columns are the
        // registered points by activity (Herald's breakdown) with those accruing hold points under HS held, so POINTS
        // is the sum of what the row displays.
        const liveRank = standing?.rank ?? player.rank;
        const livePoints = standing?.points ?? player.points;
        const rank = isFinalized ? (standing?.rank ?? Number.MAX_SAFE_INTEGER) : liveRank;
        const points = isFinalized ? (standing?.points ?? null) : livePoints;
        const accruingHoldPoints = isFinalized ? 0 : (standing?.accruingHoldPoints ?? 0);

        return {
          ...player,
          isUser: isViewerOwner(player.address, ContractAddress(account.address)),
          points,
          rank,
          isInvited,
          guild,
          activityBreakdown: activityEntry?.activityBreakdown ?? null,
          accruingHoldPoints,
          mmrDelta:
            mmr.status === "ready"
              ? (mmr.deltaByAccount.get(normalizeLeaderboardAddress(player.address)) ?? null)
              : null,
        };
      });
    return leaderboardPlayers;
  }, [
    revision,
    account.address,
    activityBreakdownsByAddress,
    store,
    isFinalized,
    mmr,
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
