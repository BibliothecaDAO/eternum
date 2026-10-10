import { isSameStarknetAddress } from "@realms-world/identity";
import { useQuery } from "@tanstack/react-query";

import { rosterWalletOf } from "@/runtime/world/directory";

import { gameSlotKeyOf } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import type { BlitzSeason, EnvironmentLedger, PayoutCurve, SlotKey } from "../value/ledger";

/**
 * A Blitz season's prize (design 5h step 8): the pool held by GameLedger, growing as games settle; at its end the
 * relay posts the MMR top list, one hour of review follows, then each winner pulls their share. The share belongs to
 * the seat's wallet, the one the shard's roster froze at slot close, whatever the payout wallet is now.
 */
export interface SeasonPrize {
  ledger: string;
  seasonId: number;
  season: BlitzSeason;
  curve: PayoutCurve;
  /** The seat's wallet, which the share is read and claimed for. */
  wallet: string;
  /** That wallet's share once the top list is posted; null before it, or for a wallet not on it. */
  share: bigint | null;
  /** The wallet's zero-based place on the posted list, which its claim names; null where `share` is. */
  position: number | null;
  claimed: boolean;
}

/** One of the player's paid games: the slot it was filled from, and their seat's wallet there. */
interface SeasonSource {
  slot: SlotKey;
  wallet: string;
}

/**
 * The player's own paid Blitz games in their history where they held a seat, newest first: the seasons the Season
 * tab can show. The directory's upcoming games say nothing about the player, so they are never among them.
 */
export const seasonSourcesOf = (history: readonly DirectoryGame[]): SeasonSource[] =>
  history
    .filter((game) => game.mode === "blitz")
    .toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at)
    .flatMap((game) => {
      const slot = gameSlotKeyOf(game);
      const wallet = rosterWalletOf(game);
      return slot && wallet ? [{ slot, wallet }] : [];
    });

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

export const seasonPrizeKey = (sources: readonly SeasonSource[]) =>
  ["ledger", "season", ...sources.map(({ slot, wallet }) => `${slot.shard}:${slot.slotId}:${wallet}`)] as const;

/**
 * The one season prize the Season tab shows, on the environment's ledger: the newest season of the player's own games
 * in which a share is still unclaimed, or else the newest season they played. Nothing is read without a game.
 */
export const useSeasonPrize = (ledger: EnvironmentLedger | null, sources: readonly SeasonSource[]) =>
  useQuery({
    queryKey: seasonPrizeKey(sources),
    queryFn: () => readSeasonPrize(ledger as EnvironmentLedger, sources),
    enabled: ledger !== null && sources.length > 0,
    refetchInterval: 60_000,
  });

const readSeasonPrize = async (read: EnvironmentLedger, sources: readonly SeasonSource[]): Promise<SeasonPrize> => {
  const seen = new Set<string>();
  let newest: SeasonPrize | null = null;
  for (const { slot, wallet } of sources) {
    const { seasonId } = await read.slot(slot);
    if (seen.has(`${seasonId}:${wallet}`)) continue;
    seen.add(`${seasonId}:${wallet}`);
    const prize = await prizeOf(read, seasonId, wallet);
    newest ??= prize;
    if (prize.share !== null && !prize.claimed) return prize;
  }
  return newest as SeasonPrize;
};

const prizeOf = async (read: EnvironmentLedger, seasonId: number, wallet: string): Promise<SeasonPrize> => {
  const season = await read.season(seasonId);
  const [curve, holding] = await Promise.all([read.preset(season.presetId), holdingOf(read, seasonId, season, wallet)]);
  return { ledger: read.address, seasonId, season, curve, wallet, ...holding };
};

/** What a wallet holds in a season: its share and place once the list is posted, and whether it is claimed. */
const holdingOf = async (read: EnvironmentLedger, seasonId: number, season: BlitzSeason, wallet: string) => {
  const [claimed, place] = await Promise.all([
    read.seasonClaimed(seasonId, wallet),
    season.posted ? findPlace(read, seasonId, season.winners, wallet) : Promise.resolve(null),
  ]);
  return { share: place?.share ?? null, position: place?.position ?? null, claimed };
};

/** The wallet's place and share on the posted top list, read in batches until it is found. */
const findPlace = async (
  read: EnvironmentLedger,
  seasonId: number,
  winners: number,
  wallet: string,
): Promise<{ position: number; share: bigint } | null> => {
  const BATCH = 25;
  for (let from = 0; from < winners; from += BATCH) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(BATCH, winners - from) }, (_, index) => read.seasonWinner(seasonId, from + index)),
    );
    const index = batch.findIndex((winner) => isSameStarknetAddress(winner.wallet, wallet));
    if (index >= 0) return { position: from + index, share: batch[index].share };
  }
  return null;
};
