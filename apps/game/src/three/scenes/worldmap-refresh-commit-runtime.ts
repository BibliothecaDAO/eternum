import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";

interface HandleWorldmapRefreshCommitRuntimeInput {
  chunkKey: string;
  commitPreparedTerrain: (preparedTerrain: unknown) => void | Promise<void>;
  /**
   * Phase 2.2: release pooled attributes held by prepared terrain that is dropped
   * (stale, or not committed) instead of committed. Optional so existing callers
   * and tests stay valid; the worldmap caller wires it to disposePreparedTerrainChunk.
   */
  disposePreparedTerrain?: (preparedTerrain: unknown) => void;
  diagnostics: WorldmapChunkDiagnostics;
  force: boolean;
  onStaleDrop?: () => void;
  preparedTerrain: unknown;
  recordChunkDiagnosticsEvent: (diagnostics: WorldmapChunkDiagnostics, event: "stale_terrain_refresh_dropped") => void;
  refreshDecision: {
    shouldCommit: boolean;
    shouldDropAsStale: boolean;
  };
  runImmediateFullManagerCatchUp: (
    chunkKey: string,
    options: { force: boolean; transitionToken: number },
  ) => Promise<void>;
  runImmediateCriticalManagerCatchUp: (
    chunkKey: string,
    options: { force: boolean; transitionToken: number },
  ) => Promise<void>;
  scheduleDeferredNonCriticalManagerCatchUp: (
    chunkKey: string,
    options: { force: boolean; transitionToken: number },
  ) => void;
  stagedPathEnabled: boolean;
  projectionSyncSucceeded: boolean;
  transitionToken: number;
}

export async function handleWorldmapRefreshCommitRuntime(
  input: HandleWorldmapRefreshCommitRuntimeInput,
): Promise<"skipped" | "stale_dropped" | "committed"> {
  if (!input.projectionSyncSucceeded) {
    return "skipped";
  }

  const hasPreparedTerrain = input.preparedTerrain !== null && input.preparedTerrain !== undefined;

  if (input.refreshDecision.shouldDropAsStale) {
    input.recordChunkDiagnosticsEvent(input.diagnostics, "stale_terrain_refresh_dropped");
    if (hasPreparedTerrain) {
      input.disposePreparedTerrain?.(input.preparedTerrain);
    }
    input.onStaleDrop?.();
    return "stale_dropped";
  }

  if (!input.refreshDecision.shouldCommit || !hasPreparedTerrain) {
    // Not committing: if terrain was prepared, release its pooled attributes.
    if (hasPreparedTerrain) {
      input.disposePreparedTerrain?.(input.preparedTerrain);
    }
    return "skipped";
  }

  await input.commitPreparedTerrain(input.preparedTerrain);
  if (input.stagedPathEnabled) {
    await input.runImmediateCriticalManagerCatchUp(input.chunkKey, {
      force: input.force,
      transitionToken: input.transitionToken,
    });
    input.scheduleDeferredNonCriticalManagerCatchUp(input.chunkKey, {
      force: input.force,
      transitionToken: input.transitionToken,
    });
  } else {
    await input.runImmediateFullManagerCatchUp(input.chunkKey, {
      force: input.force,
      transitionToken: input.transitionToken,
    });
  }

  return "committed";
}
