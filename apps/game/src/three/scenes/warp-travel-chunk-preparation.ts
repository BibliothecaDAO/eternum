import {
  prepareWorldmapChunkPresentation,
  type WorldmapChunkPresentationTimeoutInfo,
} from "./worldmap-chunk-presentation";

export interface WarpTravelChunkPreparationInput<TPreparedTerrain> {
  chunkKey: string;
  startRow: number;
  startCol: number;
  surroundingChunks: string[];
  renderSize: {
    height: number;
    width: number;
  };
  syncProjectionTiles: (chunkKey: string) => Promise<boolean>;
  updatePinnedChunks: (chunkKeys: string[]) => void;
  prewarmChunkAssets: (chunkKey: string) => Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  onChunkPrepared: (chunkKey: string) => void;
  phaseTimeoutMs?: number;
  onPhaseTimeout?: (info: WorldmapChunkPresentationTimeoutInfo) => void;
}

export async function prepareWarpTravelChunk<TPreparedTerrain>(
  input: WarpTravelChunkPreparationInput<TPreparedTerrain>,
): Promise<{ projectionSyncSucceeded: boolean; preparedTerrain: TPreparedTerrain | null }> {
  const projectionSyncPromise = input.syncProjectionTiles(input.chunkKey);
  const assetPrewarmPromise = input.prewarmChunkAssets(input.chunkKey);

  input.updatePinnedChunks(input.surroundingChunks);
  input.surroundingChunks.forEach((chunkKey) => {
    void input.syncProjectionTiles(chunkKey).catch((error) => {
      console.warn(`[ChunkSync] Projection sync failed for surrounding chunk "${chunkKey}"`, error);
    });
  });

  return prepareWorldmapChunkPresentation({
    chunkKey: input.chunkKey,
    startRow: input.startRow,
    startCol: input.startCol,
    renderSize: input.renderSize,
    projectionSyncPromise,
    assetPrewarmPromise,
    prepareTerrainChunk: input.prepareTerrainChunk,
    onChunkPrepared: input.onChunkPrepared,
    phaseTimeoutMs: input.phaseTimeoutMs,
    onPhaseTimeout: input.onPhaseTimeout,
  });
}
