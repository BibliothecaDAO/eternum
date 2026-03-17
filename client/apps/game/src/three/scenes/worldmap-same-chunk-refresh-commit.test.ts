import { describe, expect, it } from "vitest";

import { resolveSameChunkRefreshCommit } from "./worldmap-same-chunk-refresh-commit";

describe("resolveSameChunkRefreshCommit", () => {
  it("commits same-chunk refresh when token is current and chunk matches", () => {
    const decision = resolveSameChunkRefreshCommit({
      refreshToken: 5,
      currentRefreshToken: 5,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24" },
    });

    expect(decision).toEqual({ shouldCommit: true, shouldDropAsStale: false });
  });

  it("drops stale same-chunk refresh when token has been superseded", () => {
    const decision = resolveSameChunkRefreshCommit({
      refreshToken: 5,
      currentRefreshToken: 6,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24" },
    });

    expect(decision).toEqual({ shouldCommit: false, shouldDropAsStale: true });
  });

  it("drops same-chunk refresh when chunk changed during preparation", () => {
    const decision = resolveSameChunkRefreshCommit({
      refreshToken: 5,
      currentRefreshToken: 5,
      currentChunk: "48,48",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24" },
    });

    expect(decision).toEqual({ shouldCommit: false, shouldDropAsStale: true });
  });

  it("drops same-chunk refresh when prepared terrain is null", () => {
    const decision = resolveSameChunkRefreshCommit({
      refreshToken: 5,
      currentRefreshToken: 5,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: null,
    });

    expect(decision).toEqual({ shouldCommit: false, shouldDropAsStale: true });
  });

  it("drops same-chunk refresh when prepared terrain is undefined", () => {
    const decision = resolveSameChunkRefreshCommit({
      refreshToken: 5,
      currentRefreshToken: 5,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: undefined,
    });

    expect(decision).toEqual({ shouldCommit: false, shouldDropAsStale: true });
  });

  it("hydrated current-area refresh uses atomic presentation commit decision", () => {
    // Simulates a hydrated refresh where the token matches - should commit
    const commitDecision = resolveSameChunkRefreshCommit({
      refreshToken: 10,
      currentRefreshToken: 10,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24", source: "hydrated" },
    });
    expect(commitDecision.shouldCommit).toBe(true);

    // Simulates a hydrated refresh that became stale - should drop
    const staleDecision = resolveSameChunkRefreshCommit({
      refreshToken: 10,
      currentRefreshToken: 11,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24", source: "hydrated" },
    });
    expect(staleDecision.shouldDropAsStale).toBe(true);
  });

  it("terrain self-heal refresh uses atomic presentation commit decision", () => {
    // Self-heal refresh that is still current
    const commitDecision = resolveSameChunkRefreshCommit({
      refreshToken: 7,
      currentRefreshToken: 7,
      currentChunk: "0,0",
      targetChunk: "0,0",
      preparedTerrain: { chunkKey: "0,0", source: "self-heal" },
    });
    expect(commitDecision.shouldCommit).toBe(true);

    // Self-heal that was superseded by a newer refresh
    const staleDecision = resolveSameChunkRefreshCommit({
      refreshToken: 7,
      currentRefreshToken: 8,
      currentChunk: "0,0",
      targetChunk: "0,0",
      preparedTerrain: { chunkKey: "0,0", source: "self-heal" },
    });
    expect(staleDecision.shouldDropAsStale).toBe(true);
  });

  it("offscreen recovery refresh uses atomic presentation commit decision", () => {
    // Offscreen recovery that is still current
    const commitDecision = resolveSameChunkRefreshCommit({
      refreshToken: 15,
      currentRefreshToken: 15,
      currentChunk: "48,48",
      targetChunk: "48,48",
      preparedTerrain: { chunkKey: "48,48", source: "offscreen-recovery" },
    });
    expect(commitDecision.shouldCommit).toBe(true);

    // Offscreen recovery where chunk changed during prep
    const chunkChangedDecision = resolveSameChunkRefreshCommit({
      refreshToken: 15,
      currentRefreshToken: 15,
      currentChunk: "72,72",
      targetChunk: "48,48",
      preparedTerrain: { chunkKey: "48,48", source: "offscreen-recovery" },
    });
    expect(chunkChangedDecision.shouldDropAsStale).toBe(true);
  });
});
