import { useQuery } from "@tanstack/react-query";

import type { DirectoryGame } from "../herald";
import type { BlitzSeason, PayoutCurve } from "../value/ledger";
import type { PaidGameLedger } from "@realms-world/identity";

import { directoryGameEntryOf, ledgerOf } from "../value/game-entry";
import { payingWalletOf } from "../value/paying-wallet";

/**
 * A Blitz season's prize (design 5h step 8): the pool held by GameLedger, growing as games settle; at its end the
 * relay posts the MMR top list, one hour of review follows, then each winner pulls their share. The share belongs to
 * the wallet that paid in the season's games, whatever the payout wallet is now.
 */
export interface SeasonPrize {
  ledger: string;
  seasonId: number;
  season: BlitzSeason;
  curve: PayoutCurve;
  /** The account's wallet the share is read for: the one that paid in the game, null when it held no seat there. */
  wallet: string | null;
  /** That wallet's share once the top list is posted; null before it, or for a wallet not on it. */
  share: bigint | null;
  claimed: boolean;
}

/** Where the Season tab reads its prize: the player's newest paid Blitz game, or a broken entry it will not skip. */
type SeasonSource = { kind: "paid"; ledger: PaidGameLedger } | { kind: "broken" };

/**
 * The season a player's Blitz prize is read from: the newest Blitz game in their own history that is not free. The
 * directory's upcoming games say nothing about the player, so a game created for the next season never hides this
 * one's claim. A broken entry there is refused, never skipped for an older game. Null when the player has none.
 */
export const seasonSourceOf = (history: readonly DirectoryGame[]): SeasonSource | null => {
  const newest = history
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

type SeasonState = "running" | "closing" | "review" | "held" | "claim" | "claimed" | "out";

/**
 * Running until its end; closing until the top list is posted; the review hour; held while a challenge stands or the
 * posted list is shorter than the places the ledger pays (it refuses every claim until the list is whole); then a
 * winner's claim, claimed, or out of the paid places.
 */
export const seasonState = (prize: SeasonPrize, now: number): SeasonState => {
  const { season } = prize;
  if (now < season.end) return "running";
  if (!season.posted) return "closing";
  if (season.challenged || season.winners < paidPlaces(season.participants, prize.curve)) return "held";
  if (now < season.reviewUntil) return "review";
  if (prize.share === null) return "out";
  if (prize.claimed) return "claimed";
  return "claim";
};

type LedgerReads = ReturnType<typeof ledgerOf>;

export const seasonPrizeKey = (game: PaidGameLedger, account: string) =>
  ["ledger", "season", game.address, game.shard, game.gameId, account] as const;

/** The season prize of the player's newest paid game; nothing is read for a broken or absent source. */
export const useSeasonPrize = (source: SeasonSource | null, account: string | null) => {
  const game = source?.kind === "paid" ? source.ledger : null;
  return useQuery({
    queryKey: game && account ? seasonPrizeKey(game, account) : (["ledger", "season", "none"] as const),
    queryFn: () => readSeasonPrize(game as PaidGameLedger, account as string),
    enabled: game !== null && account !== null,
    refetchInterval: 60_000,
  });
};

const readSeasonPrize = async (game: PaidGameLedger, account: string): Promise<SeasonPrize> => {
  const read = ledgerOf(game);
  const [{ seasonId }, wallet] = await Promise.all([read.game(game), payingWalletOf(game, account)]);
  const season = await read.season(seasonId);
  const [curve, holding] = await Promise.all([
    read.preset(season.presetId),
    wallet ? holdingOf(read, seasonId, season, wallet) : { share: null, claimed: false },
  ]);
  return { ledger: game.address, seasonId, season, curve, wallet, ...holding };
};

/** What a wallet holds in a season: its share once the list is posted, and whether it is claimed. */
const holdingOf = async (read: LedgerReads, seasonId: number, season: BlitzSeason, wallet: string) => {
  const [claimed, share] = await Promise.all([
    read.seasonClaimed(seasonId, wallet),
    season.posted ? findShare(read, seasonId, season.winners, wallet) : Promise.resolve(null),
  ]);
  return { share, claimed };
};

/** The wallet's share on the posted top list, read in batches until it is found. */
const findShare = async (
  read: LedgerReads,
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
