import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  frontierPrizeHolders,
  type HeraldFrontierLeaderboardEntry,
  type HeraldFrontierPrize,
} from "@bibliothecadao/eternum/game-sync";

import type { SeasonPoolFigures } from "./season-list";

/*
 * A Frontier season's LORDS, as the shard holds them. The pool is the tokens deposited on the ledger for the season,
 * published to the game once (the budget row's `pool`, in whole LORDS); until then it is zero and no ruin can pay.
 * Ruins show their chest before funding; only a successful clear spends the pool. A chest pays its tier's shares at the day's price, which the budget row freezes when
 * the day opens and the preset only caps. No preset names a pool, and none names a price a chest is paid at.
 */

type Budget = Pick<NativeRows["LordsBudget"], "pool" | "day" | "price">;
type ChestRules = Pick<NativeRows["ChestRules"], "shares">;

interface Span {
  start: number;
  end: number;
}

/** A budget row with a pool published to it; a missing row, or one a draw touched before the deposit, has none. */
export const isPublished = <Row extends { pool: bigint }>(budget: Row | undefined): budget is Row =>
  budget !== undefined && budget.pool > 0n;

/**
 * What a day releases of the pool: the pool's share of the season's length that the day spans, as lords_budget.cairo
 * unlocks it (the figure unlocked through the day's end less the one through its start, each rounded down; the last
 * day stops at the season's end). Days differ in length, so they release different amounts.
 */
export const releasedInDay = (pool: bigint, season: Span, day: Span): bigint => {
  const unlockedBy = (time: number) =>
    (pool * BigInt(Math.min(time, season.end) - season.start)) / BigInt(season.end - season.start);
  return unlockedBy(day.end) - unlockedBy(day.start);
};

/**
 * A share's price on a day: the budget row's, once that day has opened. The row turns to a new day at the day's first
 * ruin roll, so before it the row still holds an earlier day's price, which says nothing of this one: null.
 */
export const sharePriceOn = (budget: Pick<Budget, "day" | "price">, day: number): bigint | null =>
  budget.day === BigInt(day) ? budget.price : null;

interface CommonChest {
  lords: number;
}

/** What a common chest pays at a share's price: the common tier's shares, as lords_budget.cairo prices a chest. */
export const commonChestAt = (shares: ChestRules["shares"], price: bigint): CommonChest => ({
  lords: Number(BigInt(shares.common) * price),
});

/** The Season page's LORDS: the pool's figures, null while none is published, and a common chest once one is priced. */
export interface SeasonLords {
  pool: SeasonPoolFigures | null;
  chest: CommonChest | undefined;
}

/**
 * The Season page's LORDS on a day of the season (`today`, with its index; null before the season starts and after it
 * ends): the pool with what today releases of it, and a common chest at today's share price. The pool is null while
 * none is published. Without today's price there is no chest to quote.
 */
export const seasonLordsOf = (
  facts: { budget: Budget | undefined; chestRules: ChestRules | undefined },
  season: Span,
  today: (Span & { index: number }) | null,
): SeasonLords => {
  const { budget, chestRules } = facts;
  if (!isPublished(budget)) return { pool: null, chest: undefined };
  const price = today && sharePriceOn(budget, today.index);
  return {
    pool: {
      lords: Number(budget.pool),
      today: today ? Number(releasedInDay(budget.pool, season, today)) : undefined,
    },
    chest: chestRules && price !== null ? commonChestAt(chestRules.shares, price) : undefined,
  };
};

/**
 * What each prize place takes of the season's prize pool, first to last, as the ledger pays it
 * (frontier_prizes.cairo, prize_amount): rank r of `count` takes `count + 1 - r` shares of `count (count + 1) / 2`,
 * each place below the first rounded down, and the first takes what the others leave, so the rounding stays with it.
 */
export const prizeShares = (pool: bigint, count: number): bigint[] => {
  if (!Number.isInteger(count) || count <= 0 || count > 100) throw new Error(`invalid prize count ${count}`);
  const n = BigInt(count);
  const shares = (n * (n + 1n)) / 2n;
  const below = Array.from({ length: count - 1 }, (_, index) => (pool * (n - BigInt(index + 1))) / shares);
  return [pool - below.reduce((sum, share) => sum + share, 0n), ...below];
};

/**
 * Who holds a prize place: a player; "open" while no player who cleared a site does; "awarding" once the ledger fixed the
 * place's winner but has not paid it yet, so no receipt names them.
 */
export type PodiumHolder = { address: string } | "open" | "awarding";

/** A prize place on the season's podium: its place, its LORDS, and who holds it. */
export type PodiumPlace = { place: number; lords: number; holder: PodiumHolder };

/**
 * The season's podium from Herald's board: null while no prize pool is published. Until the winners are posted, the
 * game's `top_n` places and what each would take, each held by the board's next player who cleared a site
 * (frontierPrizeHolders, the rule the relay posts by) or open. Once posted, the `count` places the ledger fixed, each
 * named by its award receipt: the fixed list is the ledger's, never the board's again.
 */
export const seasonPodium = (board: {
  prize: HeraldFrontierPrize | null;
  entries: readonly Pick<HeraldFrontierLeaderboardEntry, "address" | "sites_cleared">[];
}): PodiumPlace[] | null => {
  const { prize } = board;
  if (!prize) return null;
  const places = prize.count ?? prize.top_n;
  if (places === 0) return [];
  const shares = prizeShares(BigInt(prize.pool), places);
  if (prize.count !== null)
    return shares.map((lords, index) => {
      const award = prize.awards.find((each) => each.rank === index + 1);
      return award
        ? { place: index + 1, lords: Number(award.lords), holder: { address: award.address } }
        : { place: index + 1, lords: Number(lords), holder: "awarding" };
    });
  const holders = frontierPrizeHolders(board.entries, places);
  return shares.map((lords, index) => ({
    place: index + 1,
    lords: Number(lords),
    holder: holders[index] ? { address: holders[index].address } : "open",
  }));
};

/** Who won a season: its first prize place's holder, else the board's first to clear a site; none while no one has. */
export const seasonWinner = (board: Parameters<typeof seasonPodium>[0]): string | undefined => {
  const first = seasonPodium(board)?.[0]?.holder;
  return typeof first === "object" ? first.address : frontierPrizeHolders(board.entries, 1)[0]?.address;
};
