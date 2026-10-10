import { useQuery } from "@tanstack/react-query";

import type { DirectoryGame } from "../herald";
import { type BlitzSeason, ledgerReader, type PayoutCurve } from "../value/ledger";
import type { PaidGameLedger } from "@realms-world/identity";

import { directoryGameEntryOf, ledgerOf } from "../value/game-entry";

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

/** Where the season's prize is read: the newest paid Blitz's ledger, or a broken entry the season will not skip. */
type SeasonSource = { kind: "paid"; ledger: PaidGameLedger } | { kind: "broken" };

/**
 * The season a player's Blitz games run in: the newest game that is not free. A broken entry there is refused, never
 * skipped for an older game's ledger. Null when every game is free.
 */
export const seasonSourceOf = (games: readonly DirectoryGame[]): SeasonSource | null => {
  const newest = games
    .filter((game) => game.mode === "blitz")
    .toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at)
    .map(directoryGameEntryOf)
    .find((entry) => entry.kind !== "free");
  if (!newest) return null;
  return newest.kind === "paid" ? { kind: "paid", ledger: newest.ledger } : { kind: "broken" };
};

/**
 * What each paid place would take of a pool now, by the ledger's own rule: ceil(participants × paid fraction) places;
 * the first weighs 1e18 and each next one floor(the one above × decay); shares split the pool by weight, the
 * remainder to the last place.
 */
export const placeShares = (pool: bigint, participants: number, curve: PayoutCurve): bigint[] => {
  const places = paidPlaces(participants, curve);
  if (places === 0 || pool === 0n) return [];
  const weights: bigint[] = [10n ** 18n];
  while (weights.length < places) weights.push((weights[weights.length - 1] * BigInt(curve.decayBps)) / 10_000n);
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  const shares = weights.map((weight) => (pool * weight) / total);
  shares[shares.length - 1] += pool - shares.reduce((sum, share) => sum + share, 0n);
  return shares;
};

/** How many places the ledger pays: ceil(participants × paid fraction). */
const paidPlaces = (participants: number, curve: PayoutCurve) =>
  Math.ceil((participants * curve.paidFractionBps) / 10_000);

type SeasonState = "running" | "closing" | "review" | "held" | "claim" | "no-strk" | "claimed" | "out";

/**
 * Running until its end; closing until the top list is posted; the review hour; held while a challenge stands or the
 * posted list is shorter than the places the ledger pays (it refuses every claim until the list is whole); then a
 * winner's claim (waiting on STRK for the fee when the wallet has none), claimed, or out of the paid places.
 */
export const seasonState = (prize: SeasonPrize, now: number): SeasonState => {
  const { season } = prize;
  if (now < season.end) return "running";
  if (!season.posted) return "closing";
  if (season.challenged || season.winners < paidPlaces(season.participants, prize.curve)) return "held";
  if (now < season.reviewUntil) return "review";
  if (prize.share === null) return "out";
  if (prize.claimed) return "claimed";
  return prize.strk === 0n ? "no-strk" : "claim";
};

export const seasonPrizeKey = (ledger: string, seasonSource: string, wallet: string) =>
  ["ledger", "season", ledger, seasonSource, wallet] as const;

/** The season's prize, read from the paid source's ledger; nothing is read for a broken or absent source. */
export const useSeasonPrize = (source: SeasonSource | null, wallet: string | null) => {
  const ledger = source?.kind === "paid" ? source.ledger : null;
  return useQuery({
    queryKey: seasonPrizeKey(ledger?.address ?? "", ledger ? `${ledger.shard}:${ledger.gameId}` : "", wallet ?? ""),
    queryFn: () => readSeasonPrize(ledger as PaidGameLedger, wallet as string),
    enabled: ledger !== null && wallet !== null,
    refetchInterval: 60_000,
  });
};

const readSeasonPrize = async (source: PaidGameLedger, wallet: string): Promise<SeasonPrize> => {
  const read = ledgerOf(source);
  const { seasonId } = await read.game(source);
  const season = await read.season(seasonId);
  const [curve, claimed, strk, share] = await Promise.all([
    read.preset(season.presetId),
    read.seasonClaimed(seasonId, wallet),
    read.feeBalance(wallet),
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
