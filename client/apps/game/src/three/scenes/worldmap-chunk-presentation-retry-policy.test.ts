import { describe, expect, it } from "vitest";

import {
  resolveChunkPresentationRetryDecision,
  shouldClearChunkPresentationRetrySchedule,
} from "./worldmap-chunk-transition";

describe("resolveChunkPresentationRetryDecision", () => {
  it("schedules one retry when the timed-out chunk is still the active traversal target", () => {
    expect(
      resolveChunkPresentationRetryDecision({
        isSwitchedOff: false,
        transitionToken: 4,
        currentTransitionToken: 4,
        currentChunk: "0,0",
        targetChunk: "24,0",
        nowMs: 1_000,
        suppressionWindowMs: 5_000,
      }),
    ).toEqual({
      shouldScheduleRetry: true,
      shouldRecordSuppressed: false,
      nextScheduledAtMs: 1_000,
    });
  });

  it("suppresses duplicate retries inside the retry suppression window", () => {
    expect(
      resolveChunkPresentationRetryDecision({
        isSwitchedOff: false,
        transitionToken: 4,
        currentTransitionToken: 4,
        currentChunk: "0,0",
        targetChunk: "24,0",
        nowMs: 3_000,
        lastScheduledAtMs: 1_000,
        suppressionWindowMs: 5_000,
      }),
    ).toEqual({
      shouldScheduleRetry: false,
      shouldRecordSuppressed: true,
      nextScheduledAtMs: null,
    });
  });

  it("does not schedule retry when the transition is stale, switched off, or already back on the target chunk", () => {
    expect(
      resolveChunkPresentationRetryDecision({
        isSwitchedOff: true,
        transitionToken: 4,
        currentTransitionToken: 4,
        currentChunk: "0,0",
        targetChunk: "24,0",
        nowMs: 1_000,
        suppressionWindowMs: 5_000,
      }),
    ).toEqual({
      shouldScheduleRetry: false,
      shouldRecordSuppressed: false,
      nextScheduledAtMs: null,
    });

    expect(
      resolveChunkPresentationRetryDecision({
        isSwitchedOff: false,
        transitionToken: 3,
        currentTransitionToken: 4,
        currentChunk: "0,0",
        targetChunk: "24,0",
        nowMs: 1_000,
        suppressionWindowMs: 5_000,
      }),
    ).toEqual({
      shouldScheduleRetry: false,
      shouldRecordSuppressed: false,
      nextScheduledAtMs: null,
    });

    expect(
      resolveChunkPresentationRetryDecision({
        isSwitchedOff: false,
        transitionToken: 4,
        currentTransitionToken: 4,
        currentChunk: "24,0",
        targetChunk: "24,0",
        nowMs: 1_000,
        suppressionWindowMs: 5_000,
      }),
    ).toEqual({
      shouldScheduleRetry: false,
      shouldRecordSuppressed: false,
      nextScheduledAtMs: null,
    });
  });

  it("keeps the retry suppression record after the retry timer fires so repeated timeouts still back off", () => {
    expect(
      shouldClearChunkPresentationRetrySchedule({
        targetChunk: "24,0",
        outcome: "retry_timer_fired",
      }),
    ).toBe(false);
  });

  it("clears the retry suppression record once a later traversal successfully commits that chunk", () => {
    expect(
      shouldClearChunkPresentationRetrySchedule({
        targetChunk: "24,0",
        currentChunk: "24,0",
        outcome: "presentation_committed",
      }),
    ).toBe(true);
  });

  it("keeps the retry suppression record for unrelated chunk outcomes", () => {
    expect(
      shouldClearChunkPresentationRetrySchedule({
        targetChunk: "24,0",
        currentChunk: "0,0",
        outcome: "presentation_committed",
      }),
    ).toBe(false);
  });
});
