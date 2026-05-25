import {
  prepareWorldmapChunkPresentation,
  type WorldmapChunkPresentationTimeoutInfo,
} from "./worldmap-chunk-presentation";

export interface ComputeTileEntitiesOptions {
  requireStructures: boolean;
}

export interface WarpTravelChunkHydrationInput<TPreparedTerrain> {
  chunkKey: string;
  startRow: number;
  startCol: number;
  surroundingChunks: string[];
  transitionToken: number;
  renderSize: {
    height: number;
    width: number;
  };
  computeTileEntities: (chunkKey: string, options: ComputeTileEntitiesOptions) => Promise<boolean>;
  updatePinnedChunks: (chunkKeys: string[]) => void;
  updateBoundsSubscription: (chunkKey: string, transitionToken: number) => Promise<void>;
  waitForTileHydrationIdle: (chunkKey: string) => Promise<void>;
  waitForStructureHydrationIdle: (chunkKey: string) => Promise<void>;
  prewarmChunkAssets: (chunkKey: string) => Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  onChunkHydrated: (chunkKey: string) => void;
  phaseTimeoutMs?: number;
  onPhaseTimeout?: (info: WorldmapChunkPresentationTimeoutInfo) => void;
}

export async function hydrateWarpTravelChunk<TPreparedTerrain>(
  input: WarpTravelChunkHydrationInput<TPreparedTerrain>,
): Promise<{ tileFetchSucceeded: boolean; preparedTerrain: TPreparedTerrain | null }> {
  const tileFetchPromise = input.computeTileEntities(input.chunkKey, { requireStructures: true });
  const structureReadyPromise = input.waitForStructureHydrationIdle(input.chunkKey);
  const assetPrewarmPromise = input.prewarmChunkAssets(input.chunkKey);

  input.updatePinnedChunks(input.surroundingChunks);
  const boundsSwitchPromise = input.updateBoundsSubscription(input.chunkKey, input.transitionToken);
  input.surroundingChunks.forEach((chunkKey) => {
    void input.computeTileEntities(chunkKey, { requireStructures: false }).catch((error) => {
      console.warn(`[ChunkHydration] Prefetch failed for surrounding chunk "${chunkKey}"`, error);
    });
  });

  return prepareWorldmapChunkPresentation({
    chunkKey: input.chunkKey,
    startRow: input.startRow,
    startCol: input.startCol,
    renderSize: input.renderSize,
    tileFetchPromise,
    tileHydrationReadyPromise: input.waitForTileHydrationIdle(input.chunkKey),
    boundsReadyPromise: boundsSwitchPromise,
    structureReadyPromise,
    assetPrewarmPromise,
    prepareTerrainChunk: input.prepareTerrainChunk,
    onChunkReady: input.onChunkHydrated,
    phaseTimeoutMs: input.phaseTimeoutMs,
    onPhaseTimeout: input.onPhaseTimeout,
  });
}
