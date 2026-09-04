interface WorldmapRefreshPreparationResult<TPreparedTerrain, TPresentationRuntime> {
  presentationRuntime: TPresentationRuntime;
  preparedTerrain: TPreparedTerrain | null;
  projectionSyncSucceeded: boolean;
}

interface RunWorldmapRefreshRuntimeInput<TPreparedTerrain, TPresentationRuntime, TCommitStatus> {
  commitRefresh: (
    preparationResult: WorldmapRefreshPreparationResult<TPreparedTerrain, TPresentationRuntime>,
  ) => Promise<TCommitStatus>;
  prepareChunk: () => Promise<WorldmapRefreshPreparationResult<TPreparedTerrain, TPresentationRuntime>>;
  onPreparedTerrainReady: (
    preparationResult: WorldmapRefreshPreparationResult<TPreparedTerrain, TPresentationRuntime>,
  ) => void;
  refreshAreaKey: string;
  suppressedAreaKeys: Set<string>;
}

export async function runWorldmapRefreshRuntime<TPreparedTerrain, TPresentationRuntime, TCommitStatus>(
  input: RunWorldmapRefreshRuntimeInput<TPreparedTerrain, TPresentationRuntime, TCommitStatus>,
): Promise<TCommitStatus> {
  input.suppressedAreaKeys.add(input.refreshAreaKey);

  try {
    const preparationResult = await input.prepareChunk();

    if (preparationResult.projectionSyncSucceeded && preparationResult.preparedTerrain) {
      input.onPreparedTerrainReady(preparationResult);
    }

    return await input.commitRefresh(preparationResult);
  } finally {
    input.suppressedAreaKeys.delete(input.refreshAreaKey);
  }
}
