import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import { configManager, LeaderboardManager } from "@bibliothecadao/eternum";
import { useGame } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import {
  buildFinalizedBlitzStandingLookup,
  buildRegisteredPointsLookup,
  normalizeLeaderboardAddress,
} from "./finalized-blitz-leaderboard";

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
  const finalizedGame = store.get("GameRegistry", { game_id: configManager.getActiveGameId() });
  if (!finalizedGame || BigInt(finalizedGame.final_trial_id) === 0n) return null;

  const registeredPointsLookup = buildRegisteredPointsLookup(
    [...store.inGame("PlayerPoints", configManager.getActiveGameId())].map((row) => ({
      address: row.address as unknown as bigint,
      registeredPoints: row.points as bigint,
    })),
  );
  const finalizedStandings = buildFinalizedBlitzStandingLookup(
    [...store.inGame("PlayerRank", configManager.getActiveGameId())].map((row) => ({
      playerAddress: row.player as unknown as bigint,
      rank: row.rank as bigint | number,
    })),
    registeredPointsLookup,
  );
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

export const useInGameLeaderboard = (): InGameLeaderboard => {
  const {
    setup: { store },
  } = useGame();
  const isBlitz = useResolvedWorldGameMode() === "blitz";
  const leaderboardTick = useCoarseCurrentDefaultTick(LEADERBOARD_UPDATE_INTERVAL / 1_000);
  const leaderboardRevision = useWorldSlicesStore((state) => state.leaderboardRevision);

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
