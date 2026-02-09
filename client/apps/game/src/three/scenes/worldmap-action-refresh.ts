interface ShouldRefreshSelectedArmyActionPathsInput {
  selectedEntityId: number | null;
  selectedEntityIsArmy: boolean;
  previousArmiesTick: number;
  currentArmiesTick: number;
  isChunkTransitioning: boolean;
  hasPendingMovement: boolean;
}

export const shouldRefreshSelectedArmyActionPaths = ({
  selectedEntityId,
  selectedEntityIsArmy,
  previousArmiesTick,
  currentArmiesTick,
  isChunkTransitioning,
  hasPendingMovement,
}: ShouldRefreshSelectedArmyActionPathsInput): boolean => {
  if (!selectedEntityId || !selectedEntityIsArmy) {
    return false;
  }

  if (currentArmiesTick <= previousArmiesTick) {
    return false;
  }

  if (isChunkTransitioning || hasPendingMovement) {
    return false;
  }

  return true;
};
