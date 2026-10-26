import type { Tier } from "@/ui/design-system/kit/tier-chip";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import type { SeasonPoolFigures } from "./season-list";

/*
 * A Frontier season's LORDS, as the shard holds them. The pool is the tokens deposited on the ledger for the season,
 * published to the game once (the budget row's `pool`, in whole LORDS); until then it is zero and no ruin can pay.
 * Ruins show their chest before funding; only a successful clear spends the pool. A chest pays its tier's shares at the day's price, which the budget row freezes when
 * the day opens and the preset only caps. No preset names a pool, and none names a price a chest is paid at.
 */

type Budget = Pick<NativeRows["LordsBudget"], "pool" | "day" | "price">;
type ChestRules = Pick<NativeRows["ChestRules"], "price_ceiling" | "shares">;

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
  tier: Tier;
  lords: number;
}

/** What a common chest pays at a share's price: the common tier's shares, as lords_budget.cairo prices a chest. */
export const commonChestAt = (shares: ChestRules["shares"], price: bigint): CommonChest => ({
  tier: 1,
  lords: Number(BigInt(shares.common) * price),
});

/** The Season page's LORDS: the pool's figures, null while none is published, and a common chest once one is priced. */
export interface SeasonLords {
  pool: SeasonPoolFigures | null;
  chest: CommonChest | undefined;
}

/**
 * The Season page's LORDS on a day of the season (`today`, with its index; null before the season starts and after it
 * ends): the pool with what today releases of it, a share's price today under its ceiling, and a common chest at that
 * price. The pool is null while none is published. Without today's price there is no chest to quote.
 */
export const seasonLordsOf = (
  facts: { budget: Budget | undefined; chestRules: ChestRules | undefined; prize?: { pool: bigint; topN: number } },
  season: Span,
  today: (Span & { index: number }) | null,
): SeasonLords => {
  const { budget, chestRules } = facts;
  if (!isPublished(budget)) return { pool: null, chest: undefined };
  const price = today && sharePriceOn(budget, today.index);
  return {
    pool: {
      lords: Number(budget.pool),
      ...(facts.prize ? { prize: { lords: Number(facts.prize.pool), topN: facts.prize.topN } } : {}),
      today: today ? Number(releasedInDay(budget.pool, season, today)) : undefined,
      price: price === null ? undefined : Number(price),
      ceiling: chestRules && Number(chestRules.price_ceiling),
    },
    chest: chestRules && price !== null ? commonChestAt(chestRules.shares, price) : undefined,
  };
};
