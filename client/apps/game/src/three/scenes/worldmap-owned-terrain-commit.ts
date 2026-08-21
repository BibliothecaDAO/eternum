interface CommitOwnedWorldmapPreparedTerrainInput<TPreparedTerrain> {
  preparedTerrain: TPreparedTerrain;
  targetChunk: string;
  transitionToken: number;
  getCurrentTransitionToken: () => number;
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
    if (input.isSwitchedOff() || !canCommitPreparedTerrain(input.transitionToken, currentTransitionToken)) {
      input.disposePreparedTerrain(input.preparedTerrain);
      return null;
    }

    input.commitChunkAuthority(input.targetChunk);
    input.applyPreparedTerrain(input.preparedTerrain);
    return currentTransitionToken;
  });
}

function canCommitPreparedTerrain(preparedTransitionToken: number, currentTransitionToken: number): boolean {
  // Hard-timeout recovery advances authority exactly once. Let the prepared
  // target close that stalled transition; any later token belongs to newer work.
  return currentTransitionToken === preparedTransitionToken || currentTransitionToken === preparedTransitionToken + 1;
}
