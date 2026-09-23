import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import { configManager, LeaderboardManager } from "@bibliothecadao/eternum";
import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { buildFinalizedBlitzStandingLookup, normalizeLeaderboardAddress } from "./finalized-blitz-leaderboard";

interface InGameLeaderboardStanding {
  address: ContractAddress;
  rank: number;
  points: number;
  includesLiveShareholderPoints: boolean;
}

interface InGameLeaderboard {
  isFinalized: boolean;
  standingsByAddress: ReadonlyMap<string, InGameLeaderboardStanding>;
}

const buildLiveLeaderboard = (store: NativeFactStore): InGameLeaderboard => {
  const manager = LeaderboardManager.instance(store);

  const standingsByAddress = new Map<string, InGameLeaderboardStanding>();
  let rank = 0;
  manager.playersByRank.forEach(([address, points], index) => {
    if (index === 0 || points !== manager.playersByRank[index - 1][1]) rank = index + 1;
    standingsByAddress.set(normalizeLeaderboardAddress(address), {
      address,
      rank,
      points,
      includesLiveShareholderPoints: manager.getPlayerHyperstructureUnregisteredShareholderPoints(address) > 0,
    });
  });

  return { isFinalized: false, standingsByAddress };
};

const buildFinalizedBlitzLeaderboard = (store: NativeFactStore): InGameLeaderboard | null => {
  const result = store.get("BlitzResult", { game_id: configManager.getActiveGameId() });
  if (!result?.complete) return null;

  const finalizedStandings = buildFinalizedBlitzStandingLookup(result.players);
  if (finalizedStandings.size === 0) return null;

  return {
    isFinalized: true,
    standingsByAddress: new Map(
      Array.from(finalizedStandings, ([normalizedAddress, standing]) => [
        normalizedAddress,
        {
          address: ContractAddress(BigInt(normalizedAddress)),
          rank: standing.rank,
          points: standing.points,
          includesLiveShareholderPoints: false,
        },
      ]),
    ),
  };
};

const LEADERBOARD_FACTS = [
  "Hyperstructure",
  "HyperstructureShares",
  "BlitzResult",
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
