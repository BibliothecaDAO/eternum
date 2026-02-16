interface ResolveArmyTabSelectionPositionInput {
  renderedArmyPosition?: { col: number; row: number };
  selectableArmyNormalizedPosition: { col: number; row: number };
}

interface ResolveArmySelectionStartPositionInput {
  renderedManagerPosition?: { col: number; row: number };
  selectionHintPosition?: { col: number; row: number };
  trackedArmyPosition?: { col: number; row: number };
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
}

interface ShouldClearPendingArmyMovementInput {
  pendingMovementStartedAtMs?: number;
  nowMs: number;
  staleAfterMs: number;
}

interface ResolvePendingArmyMovementFallbackDelayInput {
  pendingMovementStartedAtMs?: number;
  nowMs: number;
  staleAfterMs: number;
  minRetryDelayMs?: number;
}

interface ResolvePendingArmyMovementFallbackScheduleDelayInput {
  staleAfterMs: number;
  retryDelayMs?: number;
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
 * Action origin should prefer the freshest position source.
 * Use rendered manager coordinates first, then explicit selection hints,
 * then tracked map cache as a last fallback.
 */
export function resolveArmySelectionStartPosition(input: ResolveArmySelectionStartPositionInput):
  | {
      col: number;
      row: number;
    }
  | undefined {
  if (input.renderedManagerPosition) {
    return input.renderedManagerPosition;
  }

  if (input.selectionHintPosition) {
    return input.selectionHintPosition;
  }

  return input.trackedArmyPosition;
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
    !input.armyPresentInManager
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
 * Compute how long to wait before retrying stale-pending fallback checks.
 * Returns 0 when pending state is already stale and can be cleared now.
 */
export function resolvePendingArmyMovementFallbackDelayMs(input: ResolvePendingArmyMovementFallbackDelayInput): number {
  if (input.pendingMovementStartedAtMs === undefined) {
    return 0;
  }

  const elapsedMs = input.nowMs - input.pendingMovementStartedAtMs;
  const remainingMs = input.staleAfterMs - elapsedMs;
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.max(input.minRetryDelayMs ?? 1, remainingMs);
}

/**
 * Use the stale timeout for first scheduling and retry delay for subsequent checks.
 */
export function resolvePendingArmyMovementFallbackScheduleDelayMs(
  input: ResolvePendingArmyMovementFallbackScheduleDelayInput,
): number {
  return input.retryDelayMs ?? input.staleAfterMs;
}
