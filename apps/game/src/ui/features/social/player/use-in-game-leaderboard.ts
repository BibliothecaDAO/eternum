import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { activeGameRows } from "@/sync/recs-rows";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { type ClientComponents, ContractAddress } from "@bibliothecadao/types";
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

const buildLiveLeaderboard = (components: ClientComponents): InGameLeaderboard => {
  const manager = LeaderboardManager.instance(components, LEADERBOARD_UPDATE_INTERVAL);
  manager.updatePoints();

  const standingsByAddress = new Map<string, InGameLeaderboardStanding>();
  manager.playersByRank.forEach(([address, points], index) => {
    standingsByAddress.set(normalizeLeaderboardAddress(address), {
      address,
      rank: index + 1,
      points,
      includesLiveShareholderPoints: manager.getPlayerHyperstructureUnregisteredShareholderPoints(address) > 0,
    });
  });

  return { isFinalized: false, standingsByAddress };
};

const buildFinalizedBlitzLeaderboard = (components: ClientComponents): InGameLeaderboard | null => {
  const finalizedGame = activeGameRows(components.GameRegistry).at(0);
  if (!finalizedGame || BigInt(finalizedGame.final_trial_id) === 0n) return null;

  const registeredPointsLookup = buildRegisteredPointsLookup(
    activeGameRows(components.PlayerRegisteredPoints).map((row) => ({
      address: row.address as unknown as bigint,
      registeredPoints: row.registered_points as bigint,
    })),
  );
  const finalizedStandings = buildFinalizedBlitzStandingLookup(
    activeGameRows(components.PlayerRank).map((row) => ({
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
    setup: { components },
  } = useDojo();
  const isBlitz = useResolvedWorldGameMode() === "blitz";
  const leaderboardTick = useCoarseCurrentDefaultTick(LEADERBOARD_UPDATE_INTERVAL / 1_000);
  const leaderboardRevision = useWorldSlicesStore((state) => state.leaderboardRevision);

  return useMemo(() => {
    // Both are recompute signals, not inputs: the revision for leaderboard writes reaching RECS, the tick for
    // shareholder points accruing over time. The standings themselves are read from RECS here.
    void leaderboardRevision;
    void leaderboardTick;

    if (isBlitz) {
      const finalizedLeaderboard = buildFinalizedBlitzLeaderboard(components);
      if (finalizedLeaderboard) return finalizedLeaderboard;
    }

    return buildLiveLeaderboard(components);
  }, [components, isBlitz, leaderboardRevision, leaderboardTick]);
};
