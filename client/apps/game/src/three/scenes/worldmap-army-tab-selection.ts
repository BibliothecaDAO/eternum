interface ResolveArmyTabSelectionPositionInput {
  renderedArmyPosition?: { col: number; row: number };
  selectableArmyNormalizedPosition: { col: number; row: number };
}

interface ShouldQueueArmySelectionRecoveryInput {
  deferDuringChunkTransition: boolean;
  hasPendingMovement: boolean;
  isChunkTransitioning: boolean;
  armyPresentInManager: boolean;
  recoveryInFlight: boolean;
}

export function resolveArmyTabSelectionPosition(input: ResolveArmyTabSelectionPositionInput): {
  col: number;
  row: number;
} {
  return input.renderedArmyPosition ?? input.selectableArmyNormalizedPosition;
}

export function shouldQueueArmySelectionRecovery(input: ShouldQueueArmySelectionRecoveryInput): boolean {
  return (
    input.deferDuringChunkTransition &&
    !input.hasPendingMovement &&
    !input.isChunkTransitioning &&
    !input.armyPresentInManager &&
    !input.recoveryInFlight
  );
}
