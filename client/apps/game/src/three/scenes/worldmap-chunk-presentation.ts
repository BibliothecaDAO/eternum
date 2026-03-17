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

export interface PrewarmWorldmapChunkPresentationInput<TPreparedTerrain> {
  chunkKey: string;
  prewarmToken: number;
  isLatestToken: (token: number) => boolean;
  isPresentationHot: (chunkKey: string) => boolean;
  preparePresentation: () => Promise<PreparedWorldmapChunkPresentation<TPreparedTerrain>>;
  cachePreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
}

export interface PrewarmedWorldmapChunkPresentation<TPreparedTerrain> {
  status: "prepared" | "skipped_hot" | "stale_dropped" | "fetch_failed";
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

export async function prewarmWorldmapChunkPresentation<TPreparedTerrain>(
  input: PrewarmWorldmapChunkPresentationInput<TPreparedTerrain>,
): Promise<PrewarmedWorldmapChunkPresentation<TPreparedTerrain>> {
  if (input.isPresentationHot(input.chunkKey)) {
    return {
      status: "skipped_hot",
      preparedTerrain: null,
    };
  }

  const preparedPresentation = await input.preparePresentation();
  if (!preparedPresentation.tileFetchSucceeded || preparedPresentation.preparedTerrain === null) {
    return {
      status: "fetch_failed",
      preparedTerrain: null,
    };
  }

  if (!input.isLatestToken(input.prewarmToken)) {
    return {
      status: "stale_dropped",
      preparedTerrain: null,
    };
  }

  if (input.isPresentationHot(input.chunkKey)) {
    return {
      status: "skipped_hot",
      preparedTerrain: null,
    };
  }

  input.cachePreparedTerrain(preparedPresentation.preparedTerrain);
  return {
    status: "prepared",
    preparedTerrain: preparedPresentation.preparedTerrain,
  };
}
