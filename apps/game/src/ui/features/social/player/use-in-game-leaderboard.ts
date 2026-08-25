import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import { belongsToActiveGame, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { type ClientComponents, ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { type Entity, getComponentValue, Has } from "@dojoengine/recs";
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

interface FinalizedLeaderboardEntities {
  finalEntities: Entity[];
  playerRankEntities: Entity[];
  registeredPointsEntities: Entity[];
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

const buildFinalizedBlitzLeaderboard = (
  components: ClientComponents,
  entities: FinalizedLeaderboardEntities,
): InGameLeaderboard | null => {
  // Multi-game store: another game's finalized trial or rank rows must never
  // decide (or feed) THIS game's finalized leaderboard.
  const finalTrial = entities.finalEntities
    .map((entity) => getComponentValue(components.PlayersRankFinal, entity))
    .find((row) => belongsToActiveGame(row));
  if (!finalTrial) return null;

  const registeredPointsLookup = buildRegisteredPointsLookup(
    entities.registeredPointsEntities
      .map((entity) => getComponentValue(components.PlayerRegisteredPoints, entity))
      .filter((row): row is NonNullable<typeof row> => belongsToActiveGame(row))
      .map((row) => ({
        address: row.address as unknown as bigint,
        registeredPoints: row.registered_points as bigint,
      })),
  );
  const finalizedStandings = buildFinalizedBlitzStandingLookup(
    entities.playerRankEntities
      .map((entity) => getComponentValue(components.PlayerRank, entity))
      .filter((row): row is NonNullable<typeof row> => belongsToActiveGame(row))
      .map((row) => ({
        playerAddress: row.player as unknown as bigint,
        rank: row.rank as bigint | number,
        trialId: ((row as { trial_id?: bigint }).trial_id ?? 0n) as bigint,
      })),
    finalTrial.trial_id as bigint,
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
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const playerRankEntities = useEntityQuery([Has(components.PlayerRank)]);
  const registeredPointsEntities = useEntityQuery([Has(components.PlayerRegisteredPoints)]);
  const hyperstructureEntities = useEntityQuery([Has(components.Hyperstructure)]);
  const shareholderEntities = useEntityQuery([Has(components.HyperstructureShareholders)]);

  return useMemo(() => {
    // These queries are revision signals. LeaderboardManager reads their current
    // component values directly from RECS when any membership/value update rerenders this hook.
    void hyperstructureEntities;
    void shareholderEntities;

    if (isBlitz) {
      const finalizedLeaderboard = buildFinalizedBlitzLeaderboard(components, {
        finalEntities,
        playerRankEntities,
        registeredPointsEntities,
      });
      if (finalizedLeaderboard) return finalizedLeaderboard;
    }

    return buildLiveLeaderboard(components);
  }, [
    components,
    finalEntities,
    hyperstructureEntities,
    isBlitz,
    leaderboardTick,
    playerRankEntities,
    registeredPointsEntities,
    shareholderEntities,
  ]);
};
