import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

/** Registered points carry six decimals on chain. */
export const REGISTERED_POINTS_PRECISION = 1_000_000n;
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

/** A player's place in a finalized Blitz game: the account that played it and the rank the result gives it. */
interface FinalBlitzRank {
  account: bigint;
  rank: number;
}

/**
 * The finalized Blitz ranking, best first: the result ranks wallets, and the roster reads each back to the account
 * that played, the identity every other standing is keyed by. Undefined until the result is complete and the roster
 * known; a ranked wallet missing from a known roster is a broken fact and throws.
 */
export const readFinalBlitzRanking = (store: NativeFactStore, gameId: number): FinalBlitzRank[] | undefined => {
  const result = store.get("BlitzResult", { game_id: gameId });
  const roster = store.get("BlitzRoster", { game_id: gameId });
  if (!result?.complete || !roster) return undefined;
  const accountOf = new Map(roster.players.map((player) => [player.wallet, player.account]));
  return result.players
    .map(({ wallet, rank }) => {
      const account = accountOf.get(wallet);
      if (account === undefined) throw new Error(`Blitz result ranks wallet ${wallet} outside game ${gameId}'s roster`);
      return { account, rank };
    })
    .toSorted((left, right) => left.rank - right.rank || (left.account < right.account ? -1 : 1));
};

/** A finalized standing with the registered points (six decimals) the result was ranked by. */
interface FinalBlitzStanding extends FinalBlitzRank {
  points: bigint;
}

/** The finalized ranking scored by each player's registered points; undefined while any of them is unknown. */
export const readFinalBlitzStandings = (store: NativeFactStore, gameId: number): FinalBlitzStanding[] | undefined => {
  const ranking = readFinalBlitzRanking(store, gameId);
  if (!ranking) return undefined;
  const standings: FinalBlitzStanding[] = [];
  for (const { account, rank } of ranking) {
    const points = store.requireOrAbsent("PlayerPoints", { game_id: gameId, address: account });
    if (!points.known) return undefined;
    standings.push({ account, rank, points: points.known.points });
  }
  return standings;
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
