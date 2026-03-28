const REGISTERED_POINTS_PRECISION = 1_000_000n;
const UNRANKED_LEADERBOARD_POSITION = Number.MAX_SAFE_INTEGER;

interface FinalizedBlitzPlayerRankSnapshot {
  playerAddress: bigint;
  rank: bigint | number;
  trialId: bigint;
}

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

export const buildRegisteredPointsLookup = (
  rows: ReadonlyArray<{ address: bigint; registeredPoints: bigint }>,
): Map<string, number> => {
  const registeredPointsLookup = new Map<string, number>();

  rows.forEach(({ address, registeredPoints }) => {
    registeredPointsLookup.set(
      normalizeLeaderboardAddress(address),
      Number(registeredPoints / REGISTERED_POINTS_PRECISION),
    );
  });

  return registeredPointsLookup;
};

export const buildFinalizedBlitzStandingLookup = (
  rows: ReadonlyArray<FinalizedBlitzPlayerRankSnapshot>,
  finalTrialId: bigint | undefined,
  registeredPointsLookup: ReadonlyMap<string, number>,
): Map<string, FinalizedBlitzStanding> => {
  if (finalTrialId == null) {
    return new Map();
  }

  const finalizedRows = rows
    .filter((row) => row.trialId === finalTrialId)
    .toSorted((left, right) => Number(left.rank) - Number(right.rank));

  const standingLookup = new Map<string, FinalizedBlitzStanding>();

  finalizedRows.forEach((row) => {
    const normalizedAddress = normalizeLeaderboardAddress(row.playerAddress);
    standingLookup.set(normalizedAddress, {
      rank: Number(row.rank),
      points: registeredPointsLookup.get(normalizedAddress) ?? 0,
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
