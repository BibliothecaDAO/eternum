import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";
import type { WorldmapChunkPresentationPhaseDurations } from "./worldmap-chunk-presentation-runtime";

interface RecordWorldmapTerrainReadyDurationInput {
  diagnostics: WorldmapChunkDiagnostics;
  nowMs: number;
  recordChunkDiagnosticsEvent: (
    diagnostics: WorldmapChunkDiagnostics,
    event: "terrain_ready_duration_recorded",
    context: { durationMs: number },
  ) => void;
  recordWorldmapRenderDuration: (metric: "chunkTerrainReadyMs", durationMs: number) => void;
  startedAtMs: number;
}

interface CommitWorldmapPreparedTerrainPresentationInput<TPreparedTerrain> {
  applyPreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
  diagnostics: WorldmapChunkDiagnostics;
  now: () => number;
  onAfterApply?: () => void;
  phaseDurations: WorldmapChunkPresentationPhaseDurations;
  preparedTerrain: TPreparedTerrain;
  presentationStartedAtMs: number;
  recordChunkDiagnosticsEvent: (
    diagnostics: WorldmapChunkDiagnostics,
    event: "terrain_commit_duration_recorded" | "first_visible_commit_duration_recorded" | "terrain_visible_commit",
    context?: { durationMs: number },
  ) => void;
  recordWorldmapRenderDuration: (
    metric: "chunkTerrainCommitMs" | "presentationCommittedMs" | "presentationSkewMs",
    durationMs: number,
  ) => void;
  incrementWorldmapRenderCounter: (metric: "terrainVisibleCommits") => void;
}

export function recordWorldmapTerrainReadyDuration(input: RecordWorldmapTerrainReadyDurationInput): void {
  const durationMs = input.nowMs - input.startedAtMs;
  input.recordChunkDiagnosticsEvent(input.diagnostics, "terrain_ready_duration_recorded", {
    durationMs,
  });
  input.recordWorldmapRenderDuration("chunkTerrainReadyMs", durationMs);
}

export function commitWorldmapPreparedTerrainPresentation<TPreparedTerrain>(
  input: CommitWorldmapPreparedTerrainPresentationInput<TPreparedTerrain>,
): void {
  const commitStartedAt = input.now();
  input.applyPreparedTerrain(input.preparedTerrain);
  input.onAfterApply?.();
  const commitCompletedAt = input.now();
  const terrainCommitDurationMs = commitCompletedAt - commitStartedAt;
  const firstVisibleCommitDurationMs = commitCompletedAt - input.presentationStartedAtMs;

  input.recordChunkDiagnosticsEvent(input.diagnostics, "terrain_commit_duration_recorded", {
    durationMs: terrainCommitDurationMs,
  });
  input.recordChunkDiagnosticsEvent(input.diagnostics, "first_visible_commit_duration_recorded", {
    durationMs: firstVisibleCommitDurationMs,
  });
  input.recordChunkDiagnosticsEvent(input.diagnostics, "terrain_visible_commit");
  input.recordWorldmapRenderDuration("chunkTerrainCommitMs", terrainCommitDurationMs);
  input.recordWorldmapRenderDuration("presentationCommittedMs", firstVisibleCommitDurationMs);
  input.incrementWorldmapRenderCounter("terrainVisibleCommits");

  const readinessDurations = Object.values(input.phaseDurations).filter((value) => value > 0);
  if (readinessDurations.length > 0) {
    input.recordWorldmapRenderDuration(
      "presentationSkewMs",
      Math.max(...readinessDurations) - Math.min(...readinessDurations),
    );
  }
}
