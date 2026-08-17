// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("in-game leaderboard fact ownership", () => {
  it("keeps the rank pill entirely on the RECS-backed leaderboard", () => {
    const rankPillSources = [
      readSource("src/ui/features/world/containers/top-header/top-header.tsx"),
      readSource("src/ui/features/world/containers/secondary-menu-items.tsx"),
    ];

    rankPillSources.forEach((source) => {
      expect(source).not.toContain("useLandingLeaderboardStore");
      expect(source).not.toContain("landing-leaderboard-service");
      expect(source).not.toContain("fetchPlayerEntry");
      expect(source).not.toContain("fetchLeaderboardEntries");
    });

    expect(rankPillSources[1]).toContain("useInGameLeaderboard");
  });

  it("uses SQL only for the in-session immutable-history activity breakdown", () => {
    const panelSource = readSource("src/ui/features/social/player/players-panel.tsx");
    const playerListSource = readSource("src/ui/features/social/player/player-list.tsx");
    const activityServiceSource = readSource("src/services/leaderboard/player-activity-breakdown-service.ts");

    expect(panelSource).toContain("useInGameLeaderboard");
    expect(panelSource).toContain("fetchLeaderboardActivityBreakdowns");
    expect(panelSource).not.toContain("setInterval");
    expect(panelSource).not.toContain("useLandingLeaderboardStore");
    expect(panelSource).not.toContain("LandingLeaderboardEntry");
    expect(playerListSource).toContain("activityBreakdown");
    expect(playerListSource).not.toContain("LandingLeaderboardEntry");
    expect(playerListSource).not.toContain("leaderboardRankOverride");
    expect(playerListSource).not.toContain("leaderboardPointsOverride");
    expect(activityServiceSource).toContain("row.activityBreakdown");
    expect(activityServiceSource).not.toContain("row.registeredPoints");
    expect(activityServiceSource).not.toContain("row.rank");
  });
});
