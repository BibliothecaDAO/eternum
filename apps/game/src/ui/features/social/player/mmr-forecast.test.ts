import { describe, expect, it } from "vitest";

import { rankRosterNow } from "./mmr-forecast";

describe("the roster ranked as if the game ended now", () => {
  it("ranks every seat by points in competition ranks, equal points by wallet number, no points as zero", () => {
    const roster = [
      { account: 0x1n, wallet: 0xc0n },
      { account: 0x2n, wallet: 0xa0n },
      { account: 0x3n, wallet: 0xb0n },
      { account: 0x4n, wallet: 0xd0n },
      { account: 0x5n, wallet: 0xe0n },
    ];
    const points = new Map([
      [0x1n, 300],
      [0x2n, 900],
      [0x3n, 300],
      [0x4n, 0],
    ]);

    expect(rankRosterNow(roster, (account) => points.get(account) ?? 0)).toEqual([
      { wallet: "0xa0", rank: 1 },
      { wallet: "0xb0", rank: 2 },
      { wallet: "0xc0", rank: 2 },
      { wallet: "0xd0", rank: 4 },
      { wallet: "0xe0", rank: 4 },
    ]);
  });
});
