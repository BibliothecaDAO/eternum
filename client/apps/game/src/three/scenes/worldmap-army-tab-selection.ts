interface ResolveArmyTabSelectionPositionInput {
  renderedArmyPosition?: { col: number; row: number };
  selectableArmyNormalizedPosition: { col: number; row: number };
}

interface ShouldAcceptArmyTabSelectionAttemptInput {
  hasPendingMovement: boolean;
  selectionSucceeded: boolean;
}

interface ShouldQueueArmySelectionRecoveryInput {
  deferDuringChunkTransition: boolean;
  hasPendingMovement: boolean;
  isChunkTransitioning: boolean;
  armyPresentInManager: boolean;
  recoveryInFlight: boolean;
}

interface ShouldClearPendingArmyMovementInput {
  pendingMovementStartedAtMs?: number;
  nowMs: number;
  staleAfterMs: number;
}

interface ResolvePendingArmyMovementSelectionPlanInput extends ShouldClearPendingArmyMovementInput {
  hasPendingMovement: boolean;
}

interface ResolvePendingArmyMovementFallbackPlanInput extends ShouldClearPendingArmyMovementInput {
  hasPendingMovement: boolean;
}

interface PendingArmyMovementSelectionPlan {
  shouldClearPendingMovement: boolean;
  shouldRequestChunkRefresh: boolean;
  shouldBlockSelection: boolean;
}

interface PendingArmyMovementFallbackPlan {
  shouldDeleteFallbackTimeout: boolean;
  shouldClearPendingMovement: boolean;
  shouldRequestChunkRefresh: boolean;
}

/**
 * Tab cycling should prioritize the position currently rendered in the worldmap.
 * Fallback to selectable-army snapshot coordinates when render state is unavailable.
 */
export function resolveArmyTabSelectionPosition(input: ResolveArmyTabSelectionPositionInput): {
  col: number;
  row: number;
} {
  if (input.renderedArmyPosition) {
    return input.renderedArmyPosition;
  }

  return input.selectableArmyNormalizedPosition;
}

/**
 * Tab-cycling should only stop on a candidate when the army is interactive.
 * Pending armies or failed selections should advance to the next candidate.
 */
export function shouldAcceptArmyTabSelectionAttempt(input: ShouldAcceptArmyTabSelectionAttemptInput): boolean {
  return !input.hasPendingMovement && input.selectionSucceeded;
}

/**
 * Manual selection can recover from stale chunk render state by forcing a visibility
 * refresh when an army exists in world data but is temporarily missing in the manager.
 */
export function shouldQueueArmySelectionRecovery(input: ShouldQueueArmySelectionRecoveryInput): boolean {
  return (
    input.deferDuringChunkTransition &&
    !input.hasPendingMovement &&
    !input.isChunkTransitioning &&
    !input.armyPresentInManager &&
    !input.recoveryInFlight
  );
}

/**
 * Pending movement can become stale when movement updates are missed during
 * aggressive chunk switches. Clear stale pending state so selection recovers.
 */
export function shouldClearPendingArmyMovement(input: ShouldClearPendingArmyMovementInput): boolean {
  if (input.pendingMovementStartedAtMs === undefined) {
    return true;
  }

  return input.nowMs - input.pendingMovementStartedAtMs >= input.staleAfterMs;
}

/**
 * Decide stale-clear behavior when an army selection is attempted.
 */
export function resolvePendingArmyMovementSelectionPlan(
  input: ResolvePendingArmyMovementSelectionPlanInput,
): PendingArmyMovementSelectionPlan {
  if (!input.hasPendingMovement) {
    return {
      shouldClearPendingMovement: false,
      shouldRequestChunkRefresh: false,
      shouldBlockSelection: false,
    };
  }

  const shouldClearPendingMovement = shouldClearPendingArmyMovement(input);

  return {
    shouldClearPendingMovement,
    shouldRequestChunkRefresh: true,
    shouldBlockSelection: !shouldClearPendingMovement,
  };
}

/**
 * Decide stale-clear behavior when the pending-movement fallback timer fires.
 */
export function resolvePendingArmyMovementFallbackPlan(
  input: ResolvePendingArmyMovementFallbackPlanInput,
): PendingArmyMovementFallbackPlan {
  if (!input.hasPendingMovement) {
    return {
      shouldDeleteFallbackTimeout: true,
      shouldClearPendingMovement: false,
      shouldRequestChunkRefresh: false,
    };
  }

  const shouldClearPendingMovement = shouldClearPendingArmyMovement(input);

  return {
    shouldDeleteFallbackTimeout: false,
    shouldClearPendingMovement,
    shouldRequestChunkRefresh: shouldClearPendingMovement,
  };
}
