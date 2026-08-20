interface FinalizeArmyChunkTransitionInput {
  isDestroyed: boolean;
  isWinningTransition: boolean;
  setTransitioning: (isTransitioning: boolean) => void;
  drainDeferredQueue: () => void;
  drainPreCommitQueue: () => void;
}

export function finalizeArmyChunkTransition(input: FinalizeArmyChunkTransitionInput): boolean {
  if (input.isDestroyed) {
    input.setTransitioning(false);
    return false;
  }

  if (!input.isWinningTransition) {
    return false;
  }

  input.setTransitioning(false);
  input.drainDeferredQueue();
  input.drainPreCommitQueue();
  return true;
}
