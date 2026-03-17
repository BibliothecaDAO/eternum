export interface PrepareWorldmapChunkPresentationInput<TPreparedTerrain> {
  chunkKey: string;
  startRow: number;
  startCol: number;
  renderSize: {
    height: number;
    width: number;
  };
  tileFetchPromise: Promise<boolean>;
  tileHydrationReadyPromise: Promise<void>;
  boundsReadyPromise: Promise<void>;
  structureReadyPromise: Promise<void>;
  assetPrewarmPromise: Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  onChunkReady?: (chunkKey: string) => void;
}

export interface PreparedWorldmapChunkPresentation<TPreparedTerrain> {
  tileFetchSucceeded: boolean;
  preparedTerrain: TPreparedTerrain | null;
}

export async function prepareWorldmapChunkPresentation<TPreparedTerrain>(
  input: PrepareWorldmapChunkPresentationInput<TPreparedTerrain>,
): Promise<PreparedWorldmapChunkPresentation<TPreparedTerrain>> {
  const [tileFetchSucceeded] = await Promise.all([
    input.tileFetchPromise,
    input.tileHydrationReadyPromise,
    input.boundsReadyPromise,
    input.structureReadyPromise,
    input.assetPrewarmPromise,
  ]);

  if (!tileFetchSucceeded) {
    input.onChunkReady?.(input.chunkKey);
    return {
      tileFetchSucceeded: false,
      preparedTerrain: null,
    };
  }

  const preparedTerrain = await input.prepareTerrainChunk(
    input.startRow,
    input.startCol,
    input.renderSize.height,
    input.renderSize.width,
  );
  input.onChunkReady?.(input.chunkKey);

  return {
    tileFetchSucceeded: true,
    preparedTerrain,
  };
}
