import { describe, expect, it } from "vitest";

import {
  referralCreateSchema,
  referralLeaderboardEntrySchema,
  referralStatsSchema,
  starknetReferralAddressSchema,
} from "./referrals";

describe("referral schemas", () => {
  it("accepts short and long starknet addresses", () => {
    expect(starknetReferralAddressSchema.parse("0x1")).toBe("0x1");
    expect(starknetReferralAddressSchema.parse(`0x${"a".repeat(64)}`)).toBe(`0x${"a".repeat(64)}`);
  });

  it("rejects invalid starknet addresses", () => {
    expect(starknetReferralAddressSchema.safeParse("1").success).toBe(false);
    expect(starknetReferralAddressSchema.safeParse("0xzz").success).toBe(false);
    expect(starknetReferralAddressSchema.safeParse(`0x${"a".repeat(65)}`).success).toBe(false);
  });

  it("parses referral creation payload", () => {
    const parsed = referralCreateSchema.parse({
      refereeAddress: "0xabc",
      referrerAddress: "0xdef",
      referrerUsername: "referrer",
      source: "dashboard",
    });

    expect(parsed.refereeAddress).toBe("0xabc");
    expect(parsed.referrerAddress).toBe("0xdef");
    expect(parsed.source).toBe("dashboard");
  });

  it("parses leaderboard and stats payloads", () => {
    const leaderboardEntry = referralLeaderboardEntrySchema.parse({
      rank: 1,
      referrerAddress: "0xabc",
      referrerUsername: "user",
      players: 3,
      points: 12.44,
    });

    const stats = referralStatsSchema.parse({
      referrerAddress: "0xabc",
      referrerUsername: "user",
      referredPlayers: 3,
      verifiedPlayers: 2,
      totalGamesPlayed: 9,
      totalPoints: 12.44,
    });

    expect(leaderboardEntry.rank).toBe(1);
    expect(stats.verifiedPlayers).toBe(2);
  });
});
