import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";
import { createWorldmapChunkPresentationRuntime } from "./worldmap-chunk-presentation-runtime";
import { hydrateWarpTravelChunk } from "./warp-travel-chunk-hydration";
import type { WorldmapRenderDurationMetric } from "../perf/worldmap-render-diagnostics";

interface HydrateWorldmapChunkRuntimeInput<TPreparedTerrain> {
  chunkKey: string;
  computeTileEntities: (chunkKey: string) => Promise<boolean>;
  diagnostics: WorldmapChunkDiagnostics;
  now: () => number;
  onChunkHydrated: (chunkKey: string) => void;
  onPhaseTimeout: (info: unknown) => void;
  phaseTimeoutMs?: number;
  prewarmChunkAssets: (chunkKey: string) => Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  recordChunkDiagnosticsEvent: (diagnostics: WorldmapChunkDiagnostics, event: "tile_hydration_drain_completed") => void;
  recordWorldmapRenderDuration: (metric: WorldmapRenderDurationMetric, durationMs: number) => void;
  renderSize: {
    height: number;
    width: number;
  };
  startCol: number;
  startRow: number;
  surroundingChunks: string[];
  transitionToken: number;
  updateBoundsSubscription: (chunkKey: string, transitionToken: number) => Promise<void>;
  updatePinnedChunks: (chunkKeys: string[]) => void;
  waitForStructureHydrationIdle: (chunkKey: string) => Promise<void>;
  waitForTileHydrationIdle: (chunkKey: string) => Promise<void>;
}

export async function hydrateWorldmapChunkRuntime<TPreparedTerrain>(
  input: HydrateWorldmapChunkRuntimeInput<TPreparedTerrain>,
) {
  const presentationRuntime = createWorldmapChunkPresentationRuntime({
    now: input.now,
    onChunkHydrated: input.onChunkHydrated,
    prewarmChunkAssets: input.prewarmChunkAssets,
    prepareTerrainChunk: input.prepareTerrainChunk,
    recordDuration: input.recordWorldmapRenderDuration,
    recordTileHydrationDrainCompleted: () => {
      input.recordChunkDiagnosticsEvent(input.diagnostics, "tile_hydration_drain_completed");
    },
    waitForStructureHydrationIdle: input.waitForStructureHydrationIdle,
    waitForTileHydrationIdle: input.waitForTileHydrationIdle,
  });

  const result = await hydrateWarpTravelChunk({
    chunkKey: input.chunkKey,
    startRow: input.startRow,
    startCol: input.startCol,
    surroundingChunks: input.surroundingChunks,
    transitionToken: input.transitionToken,
    renderSize: input.renderSize,
    computeTileEntities: input.computeTileEntities,
    updatePinnedChunks: input.updatePinnedChunks,
    updateBoundsSubscription: input.updateBoundsSubscription,
    waitForTileHydrationIdle: presentationRuntime.waitForTileHydrationIdle,
    waitForStructureHydrationIdle: presentationRuntime.waitForStructureHydrationIdle,
    prewarmChunkAssets: presentationRuntime.prewarmChunkAssets,
    prepareTerrainChunk: presentationRuntime.prepareTerrainChunk,
    onChunkHydrated: presentationRuntime.onChunkHydrated,
    phaseTimeoutMs: input.phaseTimeoutMs,
    onPhaseTimeout: input.onPhaseTimeout as never,
  });

  return {
    ...result,
    presentationRuntime,
  };
}
