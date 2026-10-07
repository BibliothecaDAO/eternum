import { describe, expect, it } from "vitest";

import { homecomingReturn, troopsAfterHomecoming } from "./homecoming";

describe("Homecoming", () => {
  // contracts/l3/world-native/src/tests/progression.cairo: homecoming_returns_whole_troops_and_nothing_at_common.
  it("returns whole troops at its tier's share, and nothing at common", () => {
    expect(homecomingReturn(10_000, 1)).toBe(0);
    expect(homecomingReturn(99, 4)).toBe(17);
    expect(homecomingReturn(33, 2)).toBe(0);
    expect(homecomingReturn(34, 2)).toBe(1);
    expect(homecomingReturn(100, 5)).toBe(30);
  });

  // homecoming_returns_each_expired_armys_own_share_of_its_survivors: 18% of 10,000 and 9% of 1,000 come home.
  it("adds each ended army's own share to the stock, as much as fits under the limit", () => {
    const ended = [
      { survivingTroops: 10_000, tier: 4 as const },
      { survivingTroops: 1_000, tier: 3 as const },
    ];
    expect(troopsAfterHomecoming(500, ended, undefined)).toBe(500 + 1_800 + 90);
    expect(troopsAfterHomecoming(500, ended, 2_000)).toBe(2_000);
    expect(troopsAfterHomecoming(2_500, ended, 2_000)).toBe(2_500);
  });
});
