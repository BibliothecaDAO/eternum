import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";
import { renderProfile } from "../render-profile";

interface WorldmapChunkPolicy {
  chunkSize: number;
  renderSize: { width: number; height: number };
  switchPadding: number;
  projectionSync: {
    superAreaStrides: number;
  };
  pin: {
    rowsAhead: number;
    rowsBehind: number;
    colsEachSide: number;
  };
  prefetch: {
    forwardDepthStrides: number;
    sideRadiusStrides: number;
    areaBoundaryLookaheadStrides: number;
    maxAhead: number;
    maxConcurrent: number;
  };
  visualPresentation: {
    maxCompositeChunks: number;
    rollingWindowEnabled: boolean;
    visualPageSize: { width: number; height: number };
    viewportMarginPages: number;
    maxCompositePages: number;
    criticalPageImmediateBudget: number;
    retainedPageMs: number;
    cameraSampleThrottleMs: number;
    provisionalShellEnabled: boolean;
    previousExactRetainMs: number;
  };
  cache: {
    pinnedChunkFloor: number;
    slack: number;
    recommendedMinSize: number;
  };
}

interface WorldChunkPolicyInput {
  stride: number;
  renderSize: { width: number; height: number };
  pinRadius: number;
  switchPadding: number;
  projectionSync: {
    superAreaStrides: number;
  };
  prefetch: {
    forwardDepthStrides: number;
    sideRadiusStrides: number;
    areaBoundaryLookaheadStrides: number;
    maxAhead: number;
    maxConcurrent: number;
  };
  visualPresentation: {
    maxCompositeChunks: number;
    rollingWindowEnabled: boolean;
    visualPageSize: { width: number; height: number };
    viewportMarginPages: number;
    maxCompositePages: number;
    criticalPageImmediateBudget: number;
    retainedPageMs: number;
    cameraSampleThrottleMs: number;
    provisionalShellEnabled: boolean;
    previousExactRetainMs: number;
  };
}

export function createWorldmapChunkPolicy(config: WorldChunkPolicyInput = WORLD_CHUNK_CONFIG): WorldmapChunkPolicy {
  const pinnedChunkFloor = (config.pinRadius * 2 + 1) ** 2;
  const matrixCacheSlack = 8;

  return {
    chunkSize: config.stride,
    renderSize: config.renderSize,
    switchPadding: config.switchPadding,
    projectionSync: {
      superAreaStrides: config.projectionSync.superAreaStrides,
    },
    pin: {
      rowsAhead: config.pinRadius,
      rowsBehind: config.pinRadius,
      colsEachSide: config.pinRadius,
    },
    prefetch: {
      forwardDepthStrides: Math.min(config.prefetch.forwardDepthStrides, renderProfile.prefetch.forwardDepthLimit),
      sideRadiusStrides: Math.min(config.prefetch.sideRadiusStrides, renderProfile.prefetch.sideRadiusLimit),
      areaBoundaryLookaheadStrides: Math.min(
        config.prefetch.areaBoundaryLookaheadStrides,
        renderProfile.prefetch.areaBoundaryLookaheadLimit,
      ),
      maxAhead: Math.min(config.prefetch.maxAhead, renderProfile.prefetch.maxAheadLimit),
      maxConcurrent: Math.min(config.prefetch.maxConcurrent, renderProfile.prefetch.maxConcurrentLimit),
    },
    visualPresentation: {
      maxCompositeChunks: config.visualPresentation.maxCompositeChunks,
      rollingWindowEnabled: config.visualPresentation.rollingWindowEnabled,
      visualPageSize: config.visualPresentation.visualPageSize,
      viewportMarginPages: config.visualPresentation.viewportMarginPages,
      maxCompositePages: config.visualPresentation.maxCompositePages,
      criticalPageImmediateBudget: config.visualPresentation.criticalPageImmediateBudget,
      retainedPageMs: config.visualPresentation.retainedPageMs,
      cameraSampleThrottleMs: config.visualPresentation.cameraSampleThrottleMs,
      provisionalShellEnabled: config.visualPresentation.provisionalShellEnabled,
      previousExactRetainMs: config.visualPresentation.previousExactRetainMs,
    },
    cache: {
      pinnedChunkFloor,
      slack: matrixCacheSlack,
      recommendedMinSize: pinnedChunkFloor + matrixCacheSlack,
    },
  };
}
