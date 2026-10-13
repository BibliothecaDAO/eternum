interface ShouldQueueArmySelectionRecoveryInput {
  deferDuringChunkTransition: boolean;
  isChunkTransitioning: boolean;
  armyPresentInManager: boolean;
  recoveryInFlight: boolean;
}

export function shouldQueueArmySelectionRecovery(input: ShouldQueueArmySelectionRecoveryInput): boolean {
  return (
    input.deferDuringChunkTransition &&
    !input.isChunkTransitioning &&
    !input.armyPresentInManager &&
    !input.recoveryInFlight
  );
}
