import { describe, expect, it } from "vitest";

import {
  buildFinalizedBlitzStandingLookup,
  buildRegisteredPointsLookup,
  normalizeLeaderboardAddress,
  resolveFinalizedBlitzStanding,
} from "./finalized-blitz-leaderboard";

describe("finalized blitz leaderboard helpers", () => {
  it("builds finalized standings from the final trial and registered points only", () => {
    const registeredPointsLookup = buildRegisteredPointsLookup([
      { address: 0x1n, registeredPoints: 12_500_000n },
      { address: 0x2n, registeredPoints: 9_000_000n },
    ]);

    const standingLookup = buildFinalizedBlitzStandingLookup(
      [
        { playerAddress: 0x2n, rank: 2n, trialId: 7n },
        { playerAddress: 0x1n, rank: 1n, trialId: 7n },
        { playerAddress: 0x3n, rank: 1n, trialId: 8n },
      ],
      7n,
      registeredPointsLookup,
    );

    expect(standingLookup.get(normalizeLeaderboardAddress(0x1n))).toEqual({ rank: 1, points: 12 });
    expect(standingLookup.get(normalizeLeaderboardAddress(0x2n))).toEqual({ rank: 2, points: 9 });
    expect(standingLookup.has(normalizeLeaderboardAddress(0x3n))).toBe(false);
  });

  it("marks players outside the finalized trial as unranked when finalized standings are active", () => {
    expect(resolveFinalizedBlitzStanding(null, true)).toEqual({
      rankOverride: Number.MAX_SAFE_INTEGER,
      pointsOverride: 0,
      includesLiveShareholderPoints: false,
    });
  });

  it("returns finalized rank and points overrides when a standing exists", () => {
    expect(resolveFinalizedBlitzStanding({ rank: 3, points: 44 }, true)).toEqual({
      rankOverride: 3,
      pointsOverride: 44,
      includesLiveShareholderPoints: false,
    });
  });
});
