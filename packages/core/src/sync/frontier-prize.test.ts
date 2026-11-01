import { describe, expect, it } from "vitest";

import { prizeShares } from "./frontier-prize";

describe("the season's prize places", () => {
  // frontier_prizes.cairo's prize_amount: rank r of N takes N + 1 - r shares of N(N+1)/2, rounded down below the first,
  // and the first keeps what rounding leaves.
  it.each([
    { pool: 90_000n, count: 3, places: [45_000n, 30_000n, 15_000n] },
    { pool: 300n, count: 3, places: [150n, 100n, 50n] },
    { pool: 100n, count: 3, places: [51n, 33n, 16n] },
    { pool: 10n, count: 4, places: [4n, 3n, 2n, 1n] },
    { pool: 1n, count: 3, places: [1n, 0n, 0n] },
    { pool: 7n, count: 1, places: [7n] },
  ])("splits $pool among $count places as the ledger does", ({ pool, count, places }) => {
    expect(prizeShares(pool, count)).toEqual(places);
    expect(prizeShares(pool, count).reduce((sum, share) => sum + share, 0n)).toBe(pool);
  });

  it("refuses a count the ledger refuses", () => {
    expect(() => prizeShares(300n, 0)).toThrow();
    expect(() => prizeShares(300n, 101)).toThrow();
  });
});
