interface WorldmapRefreshHydrationResult<TPreparedTerrain, TPresentationRuntime> {
  presentationRuntime: TPresentationRuntime;
  preparedTerrain: TPreparedTerrain | null;
  tileFetchSucceeded: boolean;
}

interface RunWorldmapRefreshRuntimeInput<TPreparedTerrain, TPresentationRuntime, TCommitStatus> {
  commitRefresh: (
    hydrationResult: WorldmapRefreshHydrationResult<TPreparedTerrain, TPresentationRuntime>,
  ) => Promise<TCommitStatus>;
  hydrateChunk: () => Promise<WorldmapRefreshHydrationResult<TPreparedTerrain, TPresentationRuntime>>;
  onPreparedTerrainReady: (
    hydrationResult: WorldmapRefreshHydrationResult<TPreparedTerrain, TPresentationRuntime>,
  ) => void;
  refreshAreaKey: string;
  suppressedAreaKeys: Set<string>;
}

export async function runWorldmapRefreshRuntime<TPreparedTerrain, TPresentationRuntime, TCommitStatus>(
  input: RunWorldmapRefreshRuntimeInput<TPreparedTerrain, TPresentationRuntime, TCommitStatus>,
): Promise<TCommitStatus> {
  input.suppressedAreaKeys.add(input.refreshAreaKey);

  try {
    const hydrationResult = await input.hydrateChunk();

    if (hydrationResult.tileFetchSucceeded && hydrationResult.preparedTerrain) {
      input.onPreparedTerrainReady(hydrationResult);
    }

    return await input.commitRefresh(hydrationResult);
  } finally {
    input.suppressedAreaKeys.delete(input.refreshAreaKey);
  }
}
