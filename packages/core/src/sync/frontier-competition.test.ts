import { expect, it } from "vitest";
import {
  frontierCompetitionCutoff,
  frontierCompetitionPhase,
  SEASON_ZERO_COMPETITION as policy,
} from "./frontier-competition";
import type { HeraldFrontierLeaderboard } from "./herald-http-types";

it("pins the one production season independently of its extended gameplay end", () => {
  expect(frontierCompetitionCutoff(policy.chainId, policy.gameId, policy)).toBe(1793988000);
  expect(frontierCompetitionCutoff("0x123", 1, policy)).toBeUndefined();
  expect(frontierCompetitionCutoff(policy.chainId, 2, policy)).toBeUndefined();
  expect(() => frontierCompetitionCutoff(policy.chainId, 1, { ...policy, seed: "0x123" })).toThrow("identity differs");
  expect(() => frontierCompetitionCutoff(policy.chainId, 1, { ...policy, start: 1 })).toThrow("identity differs");
});
it("stops an already-open race at confirmed cutoff without displaying unconfirmed live winners", () => {
  const board: HeraldFrontierLeaderboard = {
    game_id: "1",
    mode: "frontier",
    entries: [],
    prize: null,
    competition: { status: "live", cutoff: 100, confirmed_at: 99 },
  };
  expect(frontierCompetitionPhase(board)).toBe("live");
  expect(frontierCompetitionPhase(board, 100)).toBe("confirming");
  expect(
    frontierCompetitionPhase({
      ...board,
      competition: { status: "final", cutoff: 100, confirmed_at: 101, confirmed_block: 20, block_hash: "0x20" },
    }),
  ).toBe("final");
  expect(frontierCompetitionPhase({ ...board, competition: undefined }, 200)).toBe("live");
});
