import type { NativeRows } from "@bibliothecadao/eternum/game-client";

const REGISTERED_POINTS_PRECISION = 1_000_000n;
const UNRANKED_LEADERBOARD_POSITION = Number.MAX_SAFE_INTEGER;

interface FinalizedBlitzStanding {
  points: number;
  rank: number;
}

interface ResolvedFinalizedBlitzStanding {
  includesLiveShareholderPoints: boolean;
  pointsOverride: number;
  rankOverride: number;
}

export const normalizeLeaderboardAddress = (address: bigint | string): string => {
  const addressBigInt = typeof address === "string" ? BigInt(address) : address;
  const canonicalHex = `0x${addressBigInt.toString(16)}`.toLowerCase().replace(/^0x/, "");
  return `0x${canonicalHex.padStart(64, "0")}`;
};

export const buildFinalizedBlitzStandingLookup = (
  rows: NativeRows["BlitzResult"]["players"],
): Map<string, FinalizedBlitzStanding> => {
  const finalizedRows = rows.toSorted((left, right) => Number(left.rank) - Number(right.rank));

  const standingLookup = new Map<string, FinalizedBlitzStanding>();

  finalizedRows.forEach((row) => {
    const normalizedAddress = normalizeLeaderboardAddress(row.player);
    standingLookup.set(normalizedAddress, {
      rank: Number(row.rank),
      points: Number(row.points) / Number(REGISTERED_POINTS_PRECISION),
    });
  });

  return standingLookup;
};

export const resolveFinalizedBlitzStanding = (
  finalizedStanding: FinalizedBlitzStanding | null,
  shouldUseFinalizedStandings: boolean,
): ResolvedFinalizedBlitzStanding | null => {
  if (!shouldUseFinalizedStandings) {
    return null;
  }

  if (!finalizedStanding) {
    return {
      rankOverride: UNRANKED_LEADERBOARD_POSITION,
      pointsOverride: 0,
      includesLiveShareholderPoints: false,
    };
  }

  return {
    rankOverride: finalizedStanding.rank,
    pointsOverride: finalizedStanding.points,
    includesLiveShareholderPoints: false,
  };
};
