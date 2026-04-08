import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";

interface HandleWorldmapRefreshCommitRuntimeInput {
  chunkKey: string;
  commitPreparedTerrain: (preparedTerrain: unknown) => void;
  diagnostics: WorldmapChunkDiagnostics;
  force: boolean;
  onStaleDrop?: () => void;
  preparedTerrain: unknown;
  recordChunkDiagnosticsEvent: (diagnostics: WorldmapChunkDiagnostics, event: "stale_terrain_refresh_dropped") => void;
  refreshDecision: {
    shouldCommit: boolean;
    shouldDropAsStale: boolean;
  };
  runImmediateManagerCatchUp: (chunkKey: string, options: { force: boolean; transitionToken: number }) => Promise<void>;
  scheduleDeferredManagerCatchUp: (chunkKey: string, options: { force: boolean; transitionToken: number }) => void;
  stagedPathEnabled: boolean;
  tileFetchSucceeded: boolean;
  transitionToken: number;
}

export async function handleWorldmapRefreshCommitRuntime(
  input: HandleWorldmapRefreshCommitRuntimeInput,
): Promise<"skipped" | "stale_dropped" | "committed"> {
  if (!input.tileFetchSucceeded) {
    return "skipped";
  }

  if (input.refreshDecision.shouldDropAsStale) {
    input.recordChunkDiagnosticsEvent(input.diagnostics, "stale_terrain_refresh_dropped");
    input.onStaleDrop?.();
    return "stale_dropped";
  }

  if (!input.refreshDecision.shouldCommit || input.preparedTerrain === null || input.preparedTerrain === undefined) {
    return "skipped";
  }

  input.commitPreparedTerrain(input.preparedTerrain);
  if (input.stagedPathEnabled) {
    input.scheduleDeferredManagerCatchUp(input.chunkKey, {
      force: input.force,
      transitionToken: input.transitionToken,
    });
  } else {
    await input.runImmediateManagerCatchUp(input.chunkKey, {
      force: input.force,
      transitionToken: input.transitionToken,
    });
  }

  return "committed";
}
