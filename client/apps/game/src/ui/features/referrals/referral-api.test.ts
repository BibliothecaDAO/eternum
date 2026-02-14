import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchReferralLeaderboard, fetchReferralStats, submitReferral } from "./referral-api";

const makeResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("referral api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns duplicate status when referral already exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(makeResponse(409, { error: "duplicate" }));

    await expect(
      submitReferral(
        {
          refereeAddress: "0xabc",
          referrerAddress: "0xdef",
          source: "dashboard",
        },
        {
          playerId: "0xabc",
          walletAddress: "0xabc",
        },
      ),
    ).resolves.toEqual({ status: "duplicate" });
  });

  it("parses leaderboard entries", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeResponse(200, {
        data: [
          {
            rank: 1,
            referrerAddress: "0xABC",
            referrerUsername: "alpha",
            players: 4,
            points: 12.5,
          },
        ],
      }),
    );

    const result = await fetchReferralLeaderboard(10);

    expect(result).toHaveLength(1);
    expect(result[0].referrerAddress).toBe("0xabc");
    expect(result[0].players).toBe(4);
  });

  it("parses referral stats payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeResponse(200, {
        data: {
          referrerAddress: "0xabc",
          referrerUsername: "alpha",
          referredPlayers: 4,
          verifiedPlayers: 2,
          totalGamesPlayed: 9,
          totalPoints: 14.22,
        },
      }),
    );

    const stats = await fetchReferralStats("0xabc");

    expect(stats.referrerAddress).toBe("0xabc");
    expect(stats.totalGamesPlayed).toBe(9);
  });
});
