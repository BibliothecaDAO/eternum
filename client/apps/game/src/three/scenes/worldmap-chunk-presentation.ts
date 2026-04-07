import { settleWorldmapAsyncStage } from "./worldmap-async-timeout";

export type WorldmapChunkPresentationPhase =
  | "tile_fetch"
  | "tile_hydration"
  | "bounds_ready"
  | "structure_hydration"
  | "asset_prewarm";

export interface WorldmapChunkPresentationTimeoutInfo {
  chunkKey: string;
  phase: WorldmapChunkPresentationPhase;
  timeoutMs: number;
}

interface PrepareWorldmapChunkPresentationInput<TPreparedTerrain> {
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
  phaseTimeoutMs?: number;
  onPhaseTimeout?: (info: WorldmapChunkPresentationTimeoutInfo) => void;
}

interface PreparedWorldmapChunkPresentation<TPreparedTerrain> {
  tileFetchSucceeded: boolean;
  preparedTerrain: TPreparedTerrain | null;
  timedOutPhase?: WorldmapChunkPresentationPhase;
}

interface PrewarmWorldmapChunkPresentationInput<TPreparedTerrain> {
  chunkKey: string;
  prewarmToken: number;
  isLatestToken: (token: number) => boolean;
  isPresentationHot: (chunkKey: string) => boolean;
  preparePresentation: () => Promise<PreparedWorldmapChunkPresentation<TPreparedTerrain>>;
  cachePreparedTerrain: (preparedTerrain: TPreparedTerrain) => void;
}

interface PrewarmedWorldmapChunkPresentation<TPreparedTerrain> {
  status: "prepared" | "skipped_hot" | "stale_dropped" | "fetch_failed";
  preparedTerrain: TPreparedTerrain | null;
}

export async function prepareWorldmapChunkPresentation<TPreparedTerrain>(
  input: PrepareWorldmapChunkPresentationInput<TPreparedTerrain>,
): Promise<PreparedWorldmapChunkPresentation<TPreparedTerrain>> {
  if (input.phaseTimeoutMs === undefined || input.phaseTimeoutMs <= 0) {
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

  const resolvePhaseTimeout = (phase: WorldmapChunkPresentationPhase, timeoutMs: number) => {
    input.onPhaseTimeout?.({
      chunkKey: input.chunkKey,
      phase,
      timeoutMs,
    });
  };

  const [tileFetchResult, tileHydrationResult, boundsReadyResult, structureReadyResult, assetPrewarmResult] =
    await Promise.all([
      settleWorldmapAsyncStage({
        label: "tile_fetch" as const,
        promise: input.tileFetchPromise,
        timeoutMs: input.phaseTimeoutMs,
        onTimeout: ({ timeoutMs }) => resolvePhaseTimeout("tile_fetch", timeoutMs),
      }),
      settleWorldmapAsyncStage({
        label: "tile_hydration" as const,
        promise: input.tileHydrationReadyPromise,
        timeoutMs: input.phaseTimeoutMs,
        onTimeout: ({ timeoutMs }) => resolvePhaseTimeout("tile_hydration", timeoutMs),
      }),
      settleWorldmapAsyncStage({
        label: "bounds_ready" as const,
        promise: input.boundsReadyPromise,
        timeoutMs: input.phaseTimeoutMs,
        onTimeout: ({ timeoutMs }) => resolvePhaseTimeout("bounds_ready", timeoutMs),
      }),
      settleWorldmapAsyncStage({
        label: "structure_hydration" as const,
        promise: input.structureReadyPromise,
        timeoutMs: input.phaseTimeoutMs,
        onTimeout: ({ timeoutMs }) => resolvePhaseTimeout("structure_hydration", timeoutMs),
      }),
      settleWorldmapAsyncStage({
        label: "asset_prewarm" as const,
        promise: input.assetPrewarmPromise,
        timeoutMs: input.phaseTimeoutMs,
        onTimeout: ({ timeoutMs }) => resolvePhaseTimeout("asset_prewarm", timeoutMs),
      }),
    ]);

  const timedOutPhase =
    (tileFetchResult.status === "timed_out" && "tile_fetch") ||
    (tileHydrationResult.status === "timed_out" && "tile_hydration") ||
    (boundsReadyResult.status === "timed_out" && "bounds_ready") ||
    (structureReadyResult.status === "timed_out" && "structure_hydration") ||
    (assetPrewarmResult.status === "timed_out" && "asset_prewarm") ||
    undefined;

  if (timedOutPhase) {
    input.onChunkReady?.(input.chunkKey);
    return {
      tileFetchSucceeded: false,
      preparedTerrain: null,
      timedOutPhase,
    };
  }

  if (tileFetchResult.status !== "resolved") {
    input.onChunkReady?.(input.chunkKey);
    return {
      tileFetchSucceeded: false,
      preparedTerrain: null,
      timedOutPhase: "tile_fetch",
    };
  }

  const tileFetchSucceeded = tileFetchResult.value;
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
