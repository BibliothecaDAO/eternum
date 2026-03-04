interface MovementIndicatorCleanupInput {
  transactionResolved: boolean;
  transactionFailed: boolean;
  authoritativeMovementObserved: boolean;
  staleFallbackReached: boolean;
}

interface MovementIndicatorCleanupPlan {
  shouldCleanupNow: boolean;
  cleanupReason: "authoritative" | "failure" | "stale" | null;
}

/**
 * Keep movement indicators visible through tx submission/resolve and clear them
 * only when the world state confirms movement, a failure occurs, or stale fallback fires.
 */
export function resolveMovementIndicatorCleanupPlan(
  input: MovementIndicatorCleanupInput,
): MovementIndicatorCleanupPlan {
  if (input.transactionFailed) {
    return {
      shouldCleanupNow: true,
      cleanupReason: "failure",
    };
  }

  if (input.authoritativeMovementObserved) {
    return {
      shouldCleanupNow: true,
      cleanupReason: "authoritative",
    };
  }

  if (input.staleFallbackReached) {
    return {
      shouldCleanupNow: true,
      cleanupReason: "stale",
    };
  }

  if (input.transactionResolved) {
    return {
      shouldCleanupNow: false,
      cleanupReason: null,
    };
  }

  return {
    shouldCleanupNow: false,
    cleanupReason: null,
  };
}
