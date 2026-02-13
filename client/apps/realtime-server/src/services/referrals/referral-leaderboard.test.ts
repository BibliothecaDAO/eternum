import { describe, expect, it } from "vitest";

import {
  buildReferralLeaderboard,
  calculateReferralPoints,
  validateReferralRelationship,
} from "./referral-leaderboard";

describe("referral leaderboard scoring", () => {
  it("calculates per-referee points as games^1.3", () => {
    expect(calculateReferralPoints(0)).toBe(0);
    expect(calculateReferralPoints(1)).toBe(1);
    expect(calculateReferralPoints(5)).toBeCloseTo(Math.pow(5, 1.3), 6);
  });

  it("aggregates verified referrals by normalized referrer", () => {
    const result = buildReferralLeaderboard([
      {
        referrerAddress: "0xAbC",
        referrerUsername: "alpha",
        hasPlayed: true,
        gamesPlayed: 2,
      },
      {
        referrerAddress: "0xabc",
        referrerUsername: null,
        hasPlayed: true,
        gamesPlayed: 4,
      },
      {
        referrerAddress: "0xdef",
        referrerUsername: "beta",
        hasPlayed: false,
        gamesPlayed: 10,
      },
      {
        referrerAddress: "0xdef",
        referrerUsername: "beta",
        hasPlayed: true,
        gamesPlayed: 0,
      },
      {
        referrerAddress: "0x999",
        referrerUsername: "gamma",
        hasPlayed: true,
        gamesPlayed: 3,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      rank: 1,
      referrerAddress: "0xabc",
      players: 2,
    });
    expect(result[1]).toMatchObject({
      rank: 2,
      referrerAddress: "0x999",
      players: 1,
    });
  });

  it("rejects self-referrals case-insensitively", () => {
    const same = validateReferralRelationship("0xAbC", "0xabc");
    const different = validateReferralRelationship("0xAbC", "0xdef");

    expect(same.ok).toBe(false);
    expect(different.ok).toBe(true);
  });
});
