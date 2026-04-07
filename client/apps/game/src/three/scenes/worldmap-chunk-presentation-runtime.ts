export interface WorldmapChunkPresentationPhaseDurations {
  structureAssetPrewarmMs: number;
  structureHydrationDrainMs: number;
  terrainPreparedMs: number;
  tileHydrationDrainMs: number;
}

interface CreateWorldmapChunkPresentationRuntimeInput<TPreparedTerrain> {
  now: () => number;
  onChunkHydrated: (chunkKey: string) => void;
  prewarmChunkAssets: (chunkKey: string) => Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  recordDuration: (metric: string, durationMs: number) => void;
  recordTileHydrationDrainCompleted: () => void;
  waitForStructureHydrationIdle: (chunkKey: string) => Promise<void>;
  waitForTileHydrationIdle: (chunkKey: string) => Promise<void>;
}

export function createWorldmapChunkPresentationRuntime<TPreparedTerrain>(
  input: CreateWorldmapChunkPresentationRuntimeInput<TPreparedTerrain>,
) {
  const phaseDurations: WorldmapChunkPresentationPhaseDurations = {
    structureAssetPrewarmMs: 0,
    structureHydrationDrainMs: 0,
    terrainPreparedMs: 0,
    tileHydrationDrainMs: 0,
  };

  return {
    onChunkHydrated(chunkKey: string) {
      input.onChunkHydrated(chunkKey);
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

    async waitForStructureHydrationIdle(chunkKey: string) {
      const startedAt = input.now();
      await input.waitForStructureHydrationIdle(chunkKey);
      phaseDurations.structureHydrationDrainMs = input.now() - startedAt;
      input.recordDuration("structureHydrationDrainMs", phaseDurations.structureHydrationDrainMs);
    },

    async waitForTileHydrationIdle(chunkKey: string) {
      const startedAt = input.now();
      await input.waitForTileHydrationIdle(chunkKey);
      phaseDurations.tileHydrationDrainMs = input.now() - startedAt;
      input.recordDuration("tileHydrationDrainMs", phaseDurations.tileHydrationDrainMs);
      input.recordTileHydrationDrainCompleted();
    },
  };
}
