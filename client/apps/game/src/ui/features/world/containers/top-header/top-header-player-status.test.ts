// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveTopHeaderPlayerStatus } from "./top-header-player-status";

describe("top header player status", () => {
  it("does not label connected players as spectating while leaderboard data is missing", () => {
    const status = resolveTopHeaderPlayerStatus({
      isSpectating: false,
      rank: undefined,
      points: undefined,
    });

    expect(status).toBeNull();
  });

  it("shows a rank when a connected player has leaderboard data", () => {
    const status = resolveTopHeaderPlayerStatus({
      isSpectating: false,
      rank: 42,
      points: 1234,
    });

    expect(status).toEqual({
      type: "ranked",
      rank: 42,
      points: 1234,
    });
  });

  it("only shows spectating when the game state is spectating", () => {
    const status = resolveTopHeaderPlayerStatus({
      isSpectating: true,
      rank: undefined,
      points: undefined,
    });

    expect(status).toEqual({ type: "spectating" });
  });
});
