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
    !input.armyPresentInManager
  );
}
