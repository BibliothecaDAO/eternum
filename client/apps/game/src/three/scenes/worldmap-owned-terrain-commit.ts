interface CommitOwnedWorldmapPreparedTerrainInput<TPreparedTerrain> {
  preparedTerrain: TPreparedTerrain;
  targetChunk: string;
  transitionToken: number;
  getCurrentTransitionToken: () => number;
  getRecoveryTransitionToken: (timedOutTransitionToken: number) => number | null;
  isSwitchedOff: () => boolean;
  scheduleCommit: (commit: () => number | null) => Promise<number | null>;
  disposePreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
  commitChunkAuthority: (chunkKey: string) => void;
  applyPreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
}

export function commitOwnedWorldmapPreparedTerrain<TPreparedTerrain>(
  input: CommitOwnedWorldmapPreparedTerrainInput<TPreparedTerrain>,
): Promise<number | null> {
  return input.scheduleCommit(() => {
    const currentTransitionToken = input.getCurrentTransitionToken();
    const recoveryTransitionToken = input.getRecoveryTransitionToken(input.transitionToken);
    if (
      input.isSwitchedOff() ||
      !canCommitPreparedTerrain(input.transitionToken, currentTransitionToken, recoveryTransitionToken)
    ) {
      input.disposePreparedTerrain(input.preparedTerrain);
      return null;
    }

    input.commitChunkAuthority(input.targetChunk);
    input.applyPreparedTerrain(input.preparedTerrain);
    return input.transitionToken;
  });
}

function canCommitPreparedTerrain(
  preparedTransitionToken: number,
  currentTransitionToken: number,
  recoveryTransitionToken: number | null,
): boolean {
  return (
    currentTransitionToken === preparedTransitionToken ||
    (recoveryTransitionToken !== null && currentTransitionToken === recoveryTransitionToken)
  );
}
