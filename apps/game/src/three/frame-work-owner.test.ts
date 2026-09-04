import { describe, expect, it } from "vitest";

import { consumeDominantFrameWorkOwner, getCurrentFrameWorkOwner, runWithFrameWorkOwner } from "./frame-work-owner";

describe("frame work owner", () => {
  it("restores nested ownership and reports the dominant completed work", () => {
    const timestamps = [0, 2, 5, 11];

    runWithFrameWorkOwner(
      "chunk-work:visible",
      () => {
        expect(getCurrentFrameWorkOwner()).toBe("chunk-work:visible");
        runWithFrameWorkOwner(
          "catchup:army",
          () => {
            expect(getCurrentFrameWorkOwner()).toBe("catchup:army");
          },
          () => timestamps.shift() ?? 11,
        );
        expect(getCurrentFrameWorkOwner()).toBe("chunk-work:visible");
      },
      () => timestamps.shift() ?? 11,
    );

    expect(getCurrentFrameWorkOwner()).toBeNull();
    expect(consumeDominantFrameWorkOwner()?.owner).toBe("chunk-work:visible");
    expect(consumeDominantFrameWorkOwner()).toBeNull();
  });

  it("restores ownership when work throws", () => {
    expect(() =>
      runWithFrameWorkOwner("sync:ingest", () => {
        throw new Error("failed");
      }),
    ).toThrow("failed");

    expect(getCurrentFrameWorkOwner()).toBeNull();
    expect(consumeDominantFrameWorkOwner()?.owner).toBe("sync:ingest");
  });

  it("resets reused owner totals between frames", () => {
    runWithFrameWorkOwner("catchup:army", () => undefined, createNowSequence([0, 10]));
    expect(consumeDominantFrameWorkOwner()).toEqual({ durationMs: 10, maxCallMs: 10, owner: "catchup:army" });

    runWithFrameWorkOwner("catchup:army", () => undefined, createNowSequence([10, 11]));
    runWithFrameWorkOwner("sync:ingest", () => undefined, createNowSequence([11, 13]));

    expect(consumeDominantFrameWorkOwner()).toEqual({ durationMs: 2, maxCallMs: 2, owner: "sync:ingest" });
    expect(consumeDominantFrameWorkOwner()).toBeNull();
  });
});

function createNowSequence(timestamps: number[]): () => number {
  return () => timestamps.shift() ?? 0;
}
