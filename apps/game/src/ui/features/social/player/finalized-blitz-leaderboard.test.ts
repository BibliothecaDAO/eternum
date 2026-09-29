import { describe, expect, it } from "vitest";

import {
  buildFinalizedBlitzStandingLookup,
  normalizeLeaderboardAddress,
  resolveFinalizedBlitzStanding,
} from "./finalized-blitz-leaderboard";

describe("finalized blitz leaderboard helpers", () => {
  it("builds finalized standings from the final native result", () => {
    const standingLookup = buildFinalizedBlitzStandingLookup([
      { player: 0x2n, points: 9_000_000n, rank: 2 },
      { player: 0x1n, points: 12_500_000n, rank: 1 },
    ]);

    expect(standingLookup.get(normalizeLeaderboardAddress(0x1n))).toEqual({ rank: 1, points: 12.5 });
    expect(standingLookup.get(normalizeLeaderboardAddress(0x2n))).toEqual({ rank: 2, points: 9 });
  });

  it("marks players outside the finalized roster as unranked when finalized standings are active", () => {
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
