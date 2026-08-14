import type { WorldmapRenderDurationMetric } from "../perf/worldmap-render-diagnostics";

export interface WorldmapChunkPresentationPhaseDurations {
  structureAssetPrewarmMs: number;
  terrainPreparedMs: number;
}

interface CreateWorldmapChunkPresentationRuntimeInput<TPreparedTerrain> {
  now: () => number;
  onChunkPrepared: (chunkKey: string) => void;
  prewarmChunkAssets: (chunkKey: string) => Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  recordDuration: (metric: WorldmapRenderDurationMetric, durationMs: number) => void;
}

export function createWorldmapChunkPresentationRuntime<TPreparedTerrain>(
  input: CreateWorldmapChunkPresentationRuntimeInput<TPreparedTerrain>,
) {
  const phaseDurations: WorldmapChunkPresentationPhaseDurations = {
    structureAssetPrewarmMs: 0,
    terrainPreparedMs: 0,
  };

  return {
    onChunkPrepared(chunkKey: string) {
      input.onChunkPrepared(chunkKey);
    },

    phaseDurations,

    async prewarmChunkAssets(chunkKey: string) {
      const startedAt = input.now();
      await input.prewarmChunkAssets(chunkKey);
      phaseDurations.structureAssetPrewarmMs = input.now() - startedAt;
      input.recordDuration("structureAssetPrewarmMs", phaseDurations.structureAssetPrewarmMs);
    },

    async prepareTerrainChunk(startRow: number, startCol: number, height: number, width: number) {
      const startedAt = input.now();
      const preparedChunk = await input.prepareTerrainChunk(startRow, startCol, height, width);
      phaseDurations.terrainPreparedMs = input.now() - startedAt;
      input.recordDuration("terrainPreparedMs", phaseDurations.terrainPreparedMs);
      return preparedChunk;
    },
  };
}
