import { useQuery } from "@tanstack/react-query";

import { mainnetProvider } from "@/runtime/mainnet-rpc";

import type { DirectoryGame } from "../herald";
import { type BlitzSeason, ledgerReader, type PayoutCurve } from "../value/ledger";
import { gameLedgerOf } from "./reward";

/**
 * The Blitz season's prize (design 5h step 8): the pool held by GameLedger, growing as games settle; at its end the
 * relay posts the MMR top list, one hour of review follows, then each winner pulls their share.
 */
export interface SeasonPrize {
  ledger: string;
  seasonId: number;
  season: BlitzSeason;
  curve: PayoutCurve;
  /** The payout wallet's share once the top list is posted; null before it, or for a wallet not on it. */
  share: bigint | null;
  claimed: boolean;
  strk: bigint;
}

/** The season a player's Blitz games run in: the newest game the directory names a ledger for. */
export const seasonSourceOf = (games: readonly DirectoryGame[]) => {
  const newest = games
    .filter((game) => game.mode === "blitz")
    .toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at)
    .map(gameLedgerOf)
    .find((ledger) => ledger !== null);
  return newest ?? null;
};

/**
 * What each paid place would take of a pool now, by the ledger's own rule: ceil(participants × paid fraction) places;
 * the first weighs 1e18 and each next one floor(the one above × decay); shares split the pool by weight, the
 * remainder to the last place.
 */
export const placeShares = (pool: bigint, participants: number, curve: PayoutCurve): bigint[] => {
  const places = Math.ceil((participants * curve.paidFractionBps) / 10_000);
  if (places === 0 || pool === 0n) return [];
  const weights: bigint[] = [10n ** 18n];
  while (weights.length < places) weights.push((weights[weights.length - 1] * BigInt(curve.decayBps)) / 10_000n);
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  const shares = weights.map((weight) => (pool * weight) / total);
  shares[shares.length - 1] += pool - shares.reduce((sum, share) => sum + share, 0n);
  return shares;
};

type SeasonState = "running" | "closing" | "review" | "held" | "claim" | "no-strk" | "claimed" | "out";

/**
 * Running until its end; closing until the top list is posted; the review hour; held while a challenge stands; then
 * a winner's claim (waiting on STRK for the fee when the wallet has none), claimed, or out of the paid places.
 */
export const seasonState = (prize: SeasonPrize, now: number): SeasonState => {
  const { season } = prize;
  if (now < season.end) return "running";
  if (!season.posted) return "closing";
  if (season.challenged) return "held";
  if (now < season.reviewUntil) return "review";
  if (prize.share === null) return "out";
  if (prize.claimed) return "claimed";
  return prize.strk === 0n ? "no-strk" : "claim";
};

export const seasonPrizeKey = (ledger: string, seasonSource: string, wallet: string) =>
  ["ledger", "season", ledger, seasonSource, wallet] as const;

export const useSeasonPrize = (games: readonly DirectoryGame[], wallet: string | null) => {
  const source = seasonSourceOf(games);
  return useQuery({
    queryKey: seasonPrizeKey(
      source?.address ?? "",
      source ? `${source.key.shard}:${source.key.gameId}` : "",
      wallet ?? "",
    ),
    queryFn: () => readSeasonPrize(source as NonNullable<typeof source>, wallet as string),
    enabled: source !== null && wallet !== null,
    refetchInterval: 60_000,
  });
};

const readSeasonPrize = async (
  source: NonNullable<ReturnType<typeof seasonSourceOf>>,
  wallet: string,
): Promise<SeasonPrize> => {
  const read = ledgerReader(mainnetProvider(), source.address);
  const { seasonId } = await read.game(source.key);
  const season = await read.season(seasonId);
  const [curve, claimed, strk, share] = await Promise.all([
    read.preset(season.presetId),
    read.seasonClaimed(seasonId, wallet),
    read.strk(wallet),
    season.posted ? findShare(read, seasonId, season.winners, wallet) : Promise.resolve(null),
  ]);
  return { ledger: source.address, seasonId, season, curve, share, claimed, strk };
};

/** The wallet's share on the posted top list, read in batches until it is found. */
const findShare = async (
  read: ReturnType<typeof ledgerReader>,
  seasonId: number,
  winners: number,
  wallet: string,
): Promise<bigint | null> => {
  const BATCH = 25;
  for (let from = 0; from < winners; from += BATCH) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(BATCH, winners - from) }, (_, index) => read.seasonWinner(seasonId, from + index)),
    );
    const own = batch.find((winner) => BigInt(winner.wallet) === BigInt(wallet));
    if (own) return own.share;
  }
  return null;
};
