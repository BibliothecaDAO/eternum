import { createWorldmapChunkPresentationRuntime } from "./worldmap-chunk-presentation-runtime";
import { prepareWarpTravelChunk } from "./warp-travel-chunk-preparation";
import type { WorldmapChunkPresentationTimeoutInfo } from "./worldmap-chunk-presentation";
import type { WorldmapRenderDurationMetric } from "../perf/worldmap-render-diagnostics";

interface PrepareWorldmapChunkRuntimeInput<TPreparedTerrain> {
  chunkKey: string;
  syncProjectionTiles: (chunkKey: string) => Promise<boolean>;
  now: () => number;
  onChunkPrepared: (chunkKey: string) => void;
  onPhaseTimeout: (info: WorldmapChunkPresentationTimeoutInfo) => void;
  phaseTimeoutMs?: number;
  prewarmChunkAssets: (chunkKey: string) => Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  recordWorldmapRenderDuration: (metric: WorldmapRenderDurationMetric, durationMs: number) => void;
  renderSize: {
    height: number;
    width: number;
  };
  startCol: number;
  startRow: number;
  surroundingChunks: string[];
  updatePinnedChunks: (chunkKeys: string[]) => void;
}

export async function prepareWorldmapChunkRuntime<TPreparedTerrain>(
  input: PrepareWorldmapChunkRuntimeInput<TPreparedTerrain>,
) {
  const presentationRuntime = createWorldmapChunkPresentationRuntime({
    now: input.now,
    onChunkPrepared: input.onChunkPrepared,
    prewarmChunkAssets: input.prewarmChunkAssets,
    prepareTerrainChunk: input.prepareTerrainChunk,
    recordDuration: input.recordWorldmapRenderDuration,
  });

  const result = await prepareWarpTravelChunk({
    chunkKey: input.chunkKey,
    startRow: input.startRow,
    startCol: input.startCol,
    surroundingChunks: input.surroundingChunks,
    renderSize: input.renderSize,
    syncProjectionTiles: input.syncProjectionTiles,
    updatePinnedChunks: input.updatePinnedChunks,
    prewarmChunkAssets: presentationRuntime.prewarmChunkAssets,
    prepareTerrainChunk: presentationRuntime.prepareTerrainChunk,
    onChunkPrepared: presentationRuntime.onChunkPrepared,
    phaseTimeoutMs: input.phaseTimeoutMs,
    onPhaseTimeout: input.onPhaseTimeout,
  });

  return {
    ...result,
    presentationRuntime,
  };
}
