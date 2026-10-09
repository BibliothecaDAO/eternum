import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import * as Sentry from "@sentry/react";

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

/** A finalized standing with the registered points (six decimals) the result was ranked by. */
interface FinalBlitzStanding extends FinalBlitzRank {
  points: bigint;
}

/**
 * The finalized Blitz result as every panel shows it: waiting while the result is incomplete or its roster or any
 * ranked player's points are unknown, unavailable when its facts contradict each other, else final.
 */
type FinalBlitzResult =
  | { status: "waiting" }
  | { status: "unavailable" }
  | { status: "final"; standings: FinalBlitzStanding[] };

/**
 * The one reader of a finalized Blitz result. A broken fact is reported and read as unavailable here, once, so no
 * panel, leaderboard or headline ever throws it into a render.
 */
export const readFinalBlitzResult = (store: NativeFactStore, gameId: number): FinalBlitzResult => {
  let ranking: FinalBlitzRank[] | undefined;
  try {
    ranking = readFinalBlitzRanking(store, gameId);
  } catch (error) {
    reportBrokenResult(error);
    return { status: "unavailable" };
  }
  if (!ranking) return { status: "waiting" };
  const standings: FinalBlitzStanding[] = [];
  for (const { account, rank } of ranking) {
    const points = store.requireOrAbsent("PlayerPoints", { game_id: gameId, address: account });
    if (!points.known) return { status: "waiting" };
    standings.push({ account, rank, points: points.known.points });
  }
  return { status: "final", standings };
};

/**
 * The finalized ranking, best first: the result ranks wallets, and the roster reads each back to the account that
 * played, the identity every other standing is keyed by. Undefined until the result is complete and the roster known;
 * a ranked wallet missing from a known roster is a broken fact and throws.
 */
const readFinalBlitzRanking = (store: NativeFactStore, gameId: number): FinalBlitzRank[] | undefined => {
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

let lastReportedBrokenResult: string | undefined;

/** Every panel and clock tick reads the result, so each distinct fault is reported once, not once per read. */
const reportBrokenResult = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === lastReportedBrokenResult) return;
  lastReportedBrokenResult = message;
  console.error(`[blitz result] ${message}`);
  Sentry.captureException(error);
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
