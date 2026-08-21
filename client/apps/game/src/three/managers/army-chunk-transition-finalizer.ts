interface FinalizeArmyChunkTransitionInput {
  isDestroyed: boolean;
  isWinningTransition: boolean;
  setTransitioning: (isTransitioning: boolean) => void;
  drainDeferredQueue: () => void;
  drainPreCommitQueue: () => void;
}

export function finalizeArmyChunkTransition(input: FinalizeArmyChunkTransitionInput): boolean {
  input.setTransitioning(false);

  if (input.isDestroyed) {
    return false;
  }

  if (!input.isWinningTransition) {
    return false;
  }

  input.drainDeferredQueue();
  input.drainPreCommitQueue();
  return true;
}
