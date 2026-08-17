interface ShouldQueueArmySelectionRecoveryInput {
  deferDuringChunkTransition: boolean;
  hasPendingMovement: boolean;
  isChunkTransitioning: boolean;
  armyPresentInManager: boolean;
  recoveryInFlight: boolean;
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
