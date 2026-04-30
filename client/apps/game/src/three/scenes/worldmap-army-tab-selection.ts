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
  isOptimisticMovementActive?: boolean;
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

interface ResolvePendingArmyMovementTxFailurePlanInput {
  txHash: string;
  txEntityMap: Map<string, number>;
  pendingEntities: Set<number>;
  optimisticEntities?: Set<number>;
}

interface PendingArmyMovementTxFailurePlan {
  shouldClearPendingMovement: boolean;
  entityId: number | undefined;
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
 *
 * When optimistic movement is unresolved, selection stays blocked. The tx is
 * still valid, just visually running ahead of the indexer, and accepting a new
 * command here would create a hidden follow-up intent rather than a real tx.
 */
export function resolvePendingArmyMovementSelectionPlan(
  input: ResolvePendingArmyMovementSelectionPlanInput,
): PendingArmyMovementSelectionPlan {
  if (input.isOptimisticMovementActive) {
    return {
      shouldClearPendingMovement: false,
      shouldRequestChunkRefresh: false,
      shouldBlockSelection: true,
    };
  }

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

/**
 * Decide whether to clear pending movement when a transaction fails on-chain.
 * The txEntityMap correlates transaction hashes to the entity that initiated the move.
 */
export function resolvePendingArmyMovementTxFailurePlan(
  input: ResolvePendingArmyMovementTxFailurePlanInput,
): PendingArmyMovementTxFailurePlan {
  const entityId = input.txEntityMap.get(input.txHash);

  if (entityId === undefined) {
    return { shouldClearPendingMovement: false, entityId: undefined };
  }

  const hasPendingMovement = input.pendingEntities.has(entityId);
  const hasOptimisticMovement = input.optimisticEntities?.has(entityId) ?? false;

  if (!hasPendingMovement && !hasOptimisticMovement) {
    return { shouldClearPendingMovement: false, entityId };
  }

  return { shouldClearPendingMovement: true, entityId };
}
