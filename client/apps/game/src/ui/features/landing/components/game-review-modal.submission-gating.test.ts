import type { Chain } from "@contracts";
import { describe, expect, it } from "vitest";

import type { GameReviewData } from "@/services/review/game-review-service";

import {
  canRetryMmrUpdate,
  formatCountdown,
  getSecondsUntilScoreSubmissionOpen,
  isScoreSubmissionWindowOpen,
} from "./game-review-submission-utils";

const buildReviewData = (finalization: GameReviewData["finalization"]): GameReviewData => ({
  worldName: "test-world",
  chain: "slot" as Chain,
  topPlayers: [],
  leaderboard: [],
  personalScore: null,
  isParticipant: false,
  stats: {
    numberOfPlayers: 0,
    totalTransactions: 0,
    totalTilesExplored: 0,
    totalCampsTaken: 0,
    totalEssenceRiftsTaken: 0,
    totalHyperstructuresTaken: 0,
    totalDeadTroops: 0,
    totalT1TroopsCreated: 0,
    totalT2TroopsCreated: 0,
    totalT3TroopsCreated: 0,
  },
  finalization,
  rewards: null,
});

const baseFinalization = (): GameReviewData["finalization"] => ({
  registeredPlayers: ["0x1", "0x2"],
  registrationCount: 2,
  finalTrialId: null,
  rankingFinalized: false,
  mmrCommitted: false,
  mmrEnabled: true,
  mmrMinPlayers: 2,
  mmrTokenAddress: "0xabc",
  scoreSubmissionOpensAt: 1_000,
});

describe("game review submission gating", () => {
  it("treats unknown submission timing as open (advisory mode)", () => {
    const finalization = { ...baseFinalization(), scoreSubmissionOpensAt: null };
    const nowTs = 900;

    expect(getSecondsUntilScoreSubmissionOpen(finalization, nowTs)).toBeNull();
    expect(isScoreSubmissionWindowOpen(finalization, nowTs)).toBe(true);
  });

  it("returns countdown while submission window is still closed", () => {
    const finalization = { ...baseFinalization(), scoreSubmissionOpensAt: 1_005 };
    const nowTs = 1_000;

    expect(getSecondsUntilScoreSubmissionOpen(finalization, nowTs)).toBe(6);
    expect(isScoreSubmissionWindowOpen(finalization, nowTs)).toBe(false);
  });

  it("allows MMR retry with optimistic finalized override", () => {
    const finalization = { ...baseFinalization(), rankingFinalized: false };
    const data = buildReviewData(finalization);

    expect(canRetryMmrUpdate(data)).toBe(false);
    expect(canRetryMmrUpdate(data, true)).toBe(true);
  });

  it("formats countdown consistently", () => {
    expect(formatCountdown(0)).toBe("0s");
    expect(formatCountdown(59)).toBe("59s");
    expect(formatCountdown(61)).toBe("1m 1s");
    expect(formatCountdown(3_661)).toBe("1h 1m");
  });
});
