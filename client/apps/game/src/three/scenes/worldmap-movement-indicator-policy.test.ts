import { describe, expect, it } from "vitest";
import { resolveMovementIndicatorCleanupPlan } from "./worldmap-movement-indicator-policy";

describe("resolveMovementIndicatorCleanupPlan", () => {
  it("does not clear indicator on tx resolution alone", () => {
    expect(
      resolveMovementIndicatorCleanupPlan({
        transactionResolved: true,
        transactionFailed: false,
        authoritativeMovementObserved: false,
        staleFallbackReached: false,
      }),
    ).toEqual({
      shouldCleanupNow: false,
      cleanupReason: null,
    });
  });

  it("clears indicator when authoritative movement update arrives", () => {
    expect(
      resolveMovementIndicatorCleanupPlan({
        transactionResolved: true,
        transactionFailed: false,
        authoritativeMovementObserved: true,
        staleFallbackReached: false,
      }),
    ).toEqual({
      shouldCleanupNow: true,
      cleanupReason: "authoritative",
    });
  });

  it("clears indicator on tx failure", () => {
    expect(
      resolveMovementIndicatorCleanupPlan({
        transactionResolved: false,
        transactionFailed: true,
        authoritativeMovementObserved: false,
        staleFallbackReached: false,
      }),
    ).toEqual({
      shouldCleanupNow: true,
      cleanupReason: "failure",
    });
  });

  it("clears indicator when stale fallback is reached", () => {
    expect(
      resolveMovementIndicatorCleanupPlan({
        transactionResolved: true,
        transactionFailed: false,
        authoritativeMovementObserved: false,
        staleFallbackReached: true,
      }),
    ).toEqual({
      shouldCleanupNow: true,
      cleanupReason: "stale",
    });
  });
});
