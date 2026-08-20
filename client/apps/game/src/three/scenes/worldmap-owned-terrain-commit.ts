interface CommitOwnedWorldmapPreparedTerrainInput<TPreparedTerrain> {
  preparedTerrain: TPreparedTerrain;
  targetChunk: string;
  transitionToken: number;
  getCurrentTransitionToken: () => number;
  isSwitchedOff: () => boolean;
  scheduleCommit: (commit: () => boolean) => Promise<boolean>;
  disposePreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
  commitChunkAuthority: (chunkKey: string) => void;
  applyPreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
}

export function commitOwnedWorldmapPreparedTerrain<TPreparedTerrain>(
  input: CommitOwnedWorldmapPreparedTerrainInput<TPreparedTerrain>,
): Promise<boolean> {
  return input.scheduleCommit(() => {
    if (input.isSwitchedOff() || input.transitionToken !== input.getCurrentTransitionToken()) {
      input.disposePreparedTerrain(input.preparedTerrain);
      return false;
    }

    input.commitChunkAuthority(input.targetChunk);
    input.applyPreparedTerrain(input.preparedTerrain);
    return true;
  });
}
