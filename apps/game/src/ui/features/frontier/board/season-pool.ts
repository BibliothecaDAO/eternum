/*
 * A Frontier season's LORDS pool, as the shard holds it: the tokens deposited on the ledger for the season, published
 * to the game once (the budget row's `pool`, in whole LORDS). No preset names a pool. Until it is published the pool is
 * zero: no ruin holds a chest and nothing can be withdrawn.
 */

/** The published pool; null while the game has no budget row or one with nothing published. */
export const publishedPoolOf = (budget: { pool: bigint } | undefined): bigint | null =>
  budget && budget.pool > 0n ? budget.pool : null;

interface Span {
  start: number;
  end: number;
}

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
