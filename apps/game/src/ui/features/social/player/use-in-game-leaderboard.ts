import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import { configManager, LeaderboardManager, type PlayerStanding } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, wholePoints } from "@bibliothecadao/types";
import { useMemo } from "react";
import { normalizeLeaderboardAddress, readFinalBlitzResult } from "./finalized-blitz-leaderboard";

/** A standing as the manager reads it, ranked; a finalized one's points are all registered. */
interface InGameLeaderboardStanding extends PlayerStanding {
  rank: number;
}

interface InGameLeaderboard {
  isFinalized: boolean;
  standingsByAddress: ReadonlyMap<string, InGameLeaderboardStanding>;
}

const buildLiveLeaderboard = (store: NativeFactStore): InGameLeaderboard => {
  const standingsByAddress = new Map<string, InGameLeaderboardStanding>();
  let rank = 0;
  LeaderboardManager.instance(store).playersByRank.forEach((standing, index, ranked) => {
    if (index === 0 || standing.points !== ranked[index - 1].points) rank = index + 1;
    standingsByAddress.set(normalizeLeaderboardAddress(standing.address), { ...standing, rank });
  });

  return { isFinalized: false, standingsByAddress };
};

const buildFinalizedBlitzLeaderboard = (store: NativeFactStore): InGameLeaderboard | null => {
  const result = readFinalBlitzResult(store, configManager.getActiveGameId());
  if (result.status !== "final" || !result.standings.length) return null;

  return {
    isFinalized: true,
    standingsByAddress: new Map(
      result.standings.map(({ account, rank, points }) => [
        normalizeLeaderboardAddress(account),
        {
          address: ContractAddress(account),
          rank,
          registeredPoints: wholePoints(points),
          accruingHoldPoints: 0,
          points: wholePoints(points),
        },
      ]),
    ),
  };
};

const LEADERBOARD_FACTS = [
  "Hyperstructure",
  "HyperstructureShares",
  "BlitzResult",
  "BlitzRoster",
  "PlayerPoints",
  "GameRegistry",
] as const;

export const useInGameLeaderboard = (): InGameLeaderboard => {
  const {
    setup: { store },
  } = useGame();
  const isBlitz = useResolvedWorldGameMode() === "blitz";
  const leaderboardTick = useCoarseCurrentDefaultTick(LEADERBOARD_UPDATE_INTERVAL / 1_000);
  const leaderboardRevision = useNativeRevision(LEADERBOARD_FACTS);

  return useMemo(() => {
    // Both are recompute signals, not inputs: the revision for leaderboard writes reaching the native store, the tick for
    // shareholder points accruing over time. The standings themselves are read from the native store here.
    void leaderboardRevision;
    void leaderboardTick;

    if (isBlitz) {
      const finalizedLeaderboard = buildFinalizedBlitzLeaderboard(store);
      if (finalizedLeaderboard) return finalizedLeaderboard;
    }

    return buildLiveLeaderboard(store);
  }, [store, isBlitz, leaderboardRevision, leaderboardTick]);
};
