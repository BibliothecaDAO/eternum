import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DirectoryGame } from "../herald";
import type { BlitzSeason, PayoutCurve } from "../value/ledger";
import type { PaidGameLedger } from "@realms-world/identity";

import { directoryGameEntryOf, ledgerOf } from "../value/game-entry";
import { payingWalletKey, payingWalletOf } from "../value/paying-wallet";

/**
 * A Blitz season's prize (design 5h step 8): the pool held by GameLedger, growing as games settle; at its end the
 * relay posts the MMR top list, one hour of review follows, then each winner pulls their share. The share belongs to
 * the wallet that paid in the season's games, whatever the payout wallet is now.
 */
export interface SeasonPrize {
  ledger: string;
  seasonId: number;
  /** The season running now, shown whether or not the player is in it; any other is one the player paid into. */
  current: boolean;
  season: BlitzSeason;
  curve: PayoutCurve;
  /** The account's wallet the share is read for: one that paid in the season, null when none did. */
  wallet: string | null;
  /** That wallet's share once the top list is posted; null before it, or for a wallet not on it. */
  share: bigint | null;
  claimed: boolean;
  strk: bigint;
}

/**
 * Where the Season tab reads prizes: the season running now, from the newest paid Blitz listed anywhere, and every
 * season of the player's own finished paid games. A broken entry among them is shown as a fault, never skipped for an
 * older game's season.
 */
export interface SeasonSources {
  current: PaidGameLedger | null;
  played: PaidGameLedger[];
  broken: boolean;
}

const isBlitz = (game: DirectoryGame) => game.mode === "blitz";

/** The running season's source and the player's paid games; `history` is the player's own finished games. */
export const seasonSourcesOf = (listed: readonly DirectoryGame[], history: readonly DirectoryGame[]): SeasonSources => {
  const newest = [...listed, ...history]
    .filter(isBlitz)
    .toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at)
    .map(directoryGameEntryOf)
    .find((entry) => entry.kind !== "free");
  const own = history.filter(isBlitz).map(directoryGameEntryOf);
  return {
    current: newest?.kind === "paid" ? newest.ledger : null,
    played: own.flatMap((entry) => (entry.kind === "paid" ? [entry.ledger] : [])),
    broken: newest?.kind === "broken" || own.some((entry) => entry.kind === "broken"),
  };
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

type LedgerReads = ReturnType<typeof ledgerOf>;

const gameKey = (ledger: PaidGameLedger) => `${ledger.shard}:${ledger.gameId}`;

export const seasonPrizesKey = (sources: SeasonSources, account: string) =>
  [
    "ledger",
    "seasons",
    account,
    sources.current ? gameKey(sources.current) : "",
    sources.played.map(gameKey).join(","),
  ] as const;

/**
 * The prizes the Season tab shows, newest season first: the running season's, and every season the account paid
 * into, each read for the wallet that paid there. Nothing is read without a source or an account.
 */
export const useSeasonPrizes = (sources: SeasonSources, account: string | null) => {
  const client = useQueryClient();
  const hasSource = sources.current !== null || sources.played.length > 0;
  return useQuery({
    queryKey: account ? seasonPrizesKey(sources, account) : (["ledger", "seasons", "none"] as const),
    queryFn: () => readSeasonPrizes(client, sources, account as string),
    enabled: hasSource && account !== null,
    refetchInterval: 60_000,
  });
};

const readSeasonPrizes = async (
  client: QueryClient,
  sources: SeasonSources,
  account: string,
): Promise<SeasonPrize[]> => {
  const source = (sources.current ?? sources.played[0]) as PaidGameLedger;
  const read = ledgerOf(source);
  // A finished game's season and paying wallet never change: each is read once per session.
  const seasonOf = (game: PaidGameLedger) =>
    client.fetchQuery({
      queryKey: ["ledger", "season-of", game.address, game.shard, game.gameId],
      queryFn: async () => (await read.game(game)).seasonId,
      staleTime: Infinity,
    });
  const seats = await Promise.all(
    sources.played.map(async (game) => ({
      seasonId: await seasonOf(game),
      wallet: await client.fetchQuery({
        queryKey: payingWalletKey(game, account),
        queryFn: () => payingWalletOf(game, account),
        staleTime: Infinity,
      }),
    })),
  );
  const currentId = sources.current ? await seasonOf(sources.current) : null;
  const seasonIds = [...new Set([...(currentId === null ? [] : [currentId]), ...seats.map((seat) => seat.seasonId)])];
  const prizes = await Promise.all(
    seasonIds.map((seasonId) => {
      const wallets = seats.flatMap((seat) => (seat.seasonId === seasonId && seat.wallet ? [seat.wallet] : []));
      return readSeasonPrize(read, source.address, seasonId, seasonId === currentId, [...new Set(wallets)]);
    }),
  );
  return prizes.toSorted((a, b) => b.season.end - a.season.end);
};

const readSeasonPrize = async (
  read: LedgerReads,
  ledger: string,
  seasonId: number,
  current: boolean,
  wallets: string[],
): Promise<SeasonPrize> => {
  const season = await read.season(seasonId);
  const [curve, holders] = await Promise.all([
    read.preset(season.presetId),
    Promise.all(
      wallets.map(async (wallet) => {
        const [claimed, strk, share] = await Promise.all([
          read.seasonClaimed(seasonId, wallet),
          read.feeBalance(wallet),
          season.posted ? findShare(read, seasonId, season.winners, wallet) : Promise.resolve(null),
        ]);
        return { wallet, share, claimed, strk };
      }),
    ),
  ]);
  // A share still to claim first, then one claimed; a season the account paid into with no share shows as out.
  const holder = holders.find((one) => one.share !== null && !one.claimed) ??
    holders.find((one) => one.share !== null) ??
    holders[0] ?? { wallet: null, share: null, claimed: false, strk: 0n };
  return { ledger, seasonId, current, season, curve, ...holder };
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
