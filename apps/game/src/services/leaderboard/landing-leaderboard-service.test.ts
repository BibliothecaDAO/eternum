import { createEmptyActivityBreakdown } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it } from "vitest";
import { buildLandingLeaderboard } from "./landing-leaderboard-service";

describe("native landing leaderboard", () => {
  it("preserves Herald's competition ranks, fractional VP and zero-point players", () => {
    const entries = [
      { address: "0xa", rank: 1, totalPoints: 200.5 },
      { address: "0xb", rank: 1, totalPoints: 200.5 },
      { address: "0xc", rank: 3, totalPoints: 0 },
      { address: "0xd", rank: 3, totalPoints: 0 },
    ].map((entry) => ({
      ...entry,
      activityBreakdown: createEmptyActivityBreakdown(),
    }));
    expect(buildLandingLeaderboard(entries).map(({ address, rank, points }) => ({ address, rank, points }))).toEqual([
      { address: "0xa", rank: 1, points: 200.5 },
      { address: "0xb", rank: 1, points: 200.5 },
      { address: "0xc", rank: 3, points: 0 },
      { address: "0xd", rank: 3, points: 0 },
    ]);
  });
  it("uses Herald’s complete breakdown instead of a page of stories", () => {
    const activityBreakdown = createEmptyActivityBreakdown();
    activityBreakdown.exploration = { count: 166, points: 830 };
    activityBreakdown.openRelicChest = { count: 3, points: 750 };
    const [entry] = buildLandingLeaderboard([{ address: "0xa", rank: 1, totalPoints: 1580, activityBreakdown }]);
    expect(entry.exploredTiles).toBe(166);
    expect(entry.exploredTilePoints).toBe(830);
    expect(entry.relicCratesOpened).toBe(3);
    expect(entry.relicCratePoints).toBe(750);
  });
});
