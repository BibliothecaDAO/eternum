import { settleWorldmapAsyncStage } from "./worldmap-async-timeout";

export type WorldmapChunkPresentationPhase = "projection_sync" | "asset_prewarm";

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
  projectionSyncPromise: Promise<boolean>;
  assetPrewarmPromise: Promise<void>;
  prepareTerrainChunk: (startRow: number, startCol: number, height: number, width: number) => Promise<TPreparedTerrain>;
  onChunkPrepared?: (chunkKey: string) => void;
  phaseTimeoutMs?: number;
  onPhaseTimeout?: (info: WorldmapChunkPresentationTimeoutInfo) => void;
}

interface PreparedWorldmapChunkPresentation<TPreparedTerrain> {
  projectionSyncSucceeded: boolean;
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
  /**
   * Phase 2.2: release the pooled attributes held by a prepared presentation that
   * is dropped (stale token, or the chunk became hot during preparation) instead
   * of cached. The caller discards the return value, so without this the pooled
   * InstancedBufferAttributes leak.
   */
  disposePreparedTerrain?: (preparedTerrain: TPreparedTerrain) => void;
}

interface PrewarmedWorldmapChunkPresentation<TPreparedTerrain> {
  status: "prepared" | "skipped_hot" | "stale_dropped" | "sync_failed";
  preparedTerrain: TPreparedTerrain | null;
}

export async function prepareWorldmapChunkPresentation<TPreparedTerrain>(
  input: PrepareWorldmapChunkPresentationInput<TPreparedTerrain>,
): Promise<PreparedWorldmapChunkPresentation<TPreparedTerrain>> {
  if (input.phaseTimeoutMs === undefined || input.phaseTimeoutMs <= 0) {
    const [projectionSyncSucceeded] = await Promise.all([input.projectionSyncPromise, input.assetPrewarmPromise]);

    if (!projectionSyncSucceeded) {
      input.onChunkPrepared?.(input.chunkKey);
      return {
        projectionSyncSucceeded: false,
        preparedTerrain: null,
      };
    }

    const preparedTerrain = await input.prepareTerrainChunk(
      input.startRow,
      input.startCol,
      input.renderSize.height,
      input.renderSize.width,
    );
    input.onChunkPrepared?.(input.chunkKey);

    return {
      projectionSyncSucceeded: true,
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

  void settleWorldmapAsyncStage({
    label: "asset_prewarm" as const,
    promise: input.assetPrewarmPromise,
    timeoutMs: input.phaseTimeoutMs,
    onTimeout: ({ timeoutMs }) => resolvePhaseTimeout("asset_prewarm", timeoutMs),
  });

  const projectionSyncResult = await settleWorldmapAsyncStage({
    label: "projection_sync" as const,
    promise: input.projectionSyncPromise,
    timeoutMs: input.phaseTimeoutMs,
    onTimeout: ({ timeoutMs }) => resolvePhaseTimeout("projection_sync", timeoutMs),
  });

  if (projectionSyncResult.status !== "resolved") {
    input.onChunkPrepared?.(input.chunkKey);
    return {
      projectionSyncSucceeded: false,
      preparedTerrain: null,
      timedOutPhase: "projection_sync",
    };
  }

  const projectionSyncSucceeded = projectionSyncResult.value;
  if (!projectionSyncSucceeded) {
    input.onChunkPrepared?.(input.chunkKey);
    return {
      projectionSyncSucceeded: false,
      preparedTerrain: null,
    };
  }

  const preparedTerrain = await input.prepareTerrainChunk(
    input.startRow,
    input.startCol,
    input.renderSize.height,
    input.renderSize.width,
  );
  input.onChunkPrepared?.(input.chunkKey);

  return {
    projectionSyncSucceeded: true,
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
  if (!preparedPresentation.projectionSyncSucceeded || preparedPresentation.preparedTerrain === null) {
    return {
      status: "sync_failed",
      preparedTerrain: null,
    };
  }

  if (!input.isLatestToken(input.prewarmToken)) {
    input.disposePreparedTerrain?.(preparedPresentation.preparedTerrain);
    return {
      status: "stale_dropped",
      preparedTerrain: null,
    };
  }

  if (input.isPresentationHot(input.chunkKey)) {
    input.disposePreparedTerrain?.(preparedPresentation.preparedTerrain);
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
