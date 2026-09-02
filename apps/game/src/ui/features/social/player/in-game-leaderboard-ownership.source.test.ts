// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("in-game leaderboard fact ownership", () => {
  it("keeps the rank pill entirely on the RECS-backed leaderboard", () => {
    // The rank now renders in the identity chip; the top header mounts it.
    const rankPillSources = [
      readSource("src/ui/features/world/containers/top-header/top-header.tsx"),
      readSource("src/ui/features/world/containers/top-header/identity-chip.tsx"),
    ];

    rankPillSources.forEach((source) => {
      expect(source).not.toContain("useLandingLeaderboardStore");
      expect(source).not.toContain("landing-leaderboard-service");
      expect(source).not.toContain("fetchPlayerEntry");
      expect(source).not.toContain("fetchLeaderboardEntries");
    });

    expect(rankPillSources[1]).toContain("useInGameLeaderboard");
  });

  it("feeds the live leaderboard row from the one SQL aggregate; finalized standings stay on RECS", () => {
    const panelSource = readSource("src/ui/features/social/player/players-panel.tsx");
    const playerListSource = readSource("src/ui/features/social/player/player-list.tsx");
    const activityServiceSource = readSource("src/services/leaderboard/player-activity-breakdown-service.ts");

    // Owner ruling (Aug 2026): in a LIVE game, the POINTS/RANK columns display
    // the same SQL leaderboard aggregate that feeds the breakdown columns, so a
    // row's total is always the sum of what it shows. Finalized games keep the
    // RECS-backed final standings, and tx flows (register/claim) stay on RECS.
    expect(panelSource).toContain("useInGameLeaderboard");
    expect(panelSource).toContain("fetchLeaderboardActivityBreakdowns");
    expect(panelSource).toContain("activityEntry?.totalPoints");
    expect(panelSource).toContain("isFinalized ? (standing?.points ?? 0)");
    expect(panelSource).not.toContain("setInterval");
    expect(panelSource).not.toContain("useLandingLeaderboardStore");
    expect(panelSource).not.toContain("LandingLeaderboardEntry");
    expect(playerListSource).toContain("activityBreakdown");
    expect(playerListSource).not.toContain("LandingLeaderboardEntry");
    expect(playerListSource).not.toContain("leaderboardRankOverride");
    expect(playerListSource).not.toContain("leaderboardPointsOverride");
    expect(activityServiceSource).toContain("row.activityBreakdown");
    expect(activityServiceSource).toContain("row.totalPoints");
    expect(activityServiceSource).not.toContain("row.registeredPoints");
  });

  it("builds the Blitz player list from the active game's settlement membership", () => {
    const socialSource = readSource("src/ui/features/social/components/social-board.tsx");

    expect(socialSource).toContain("useWorldSlicesStore((state) => state.blitzSettlementPlayers)");
    expect(socialSource).toContain("filterPlayersByBlitzSettlement(allPlayers, blitzSettlementPlayerAddresses)");
    // The structures slice is already narrowed to the active game by the bridge.
    expect(socialSource).toContain("useWorldSlicesStore((state) => state.structures)");
  });
});
