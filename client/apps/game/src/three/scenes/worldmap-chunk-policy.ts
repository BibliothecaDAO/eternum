import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";

interface WorldmapChunkPolicy {
  chunkSize: number;
  renderSize: { width: number; height: number };
  switchPadding: number;
  toriiFetch: {
    superAreaStrides: number;
    explorerTroopsSuperAreaStrides: number;
    structuresSuperAreaStrides: number;
  };
  toriiSubscription: {
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
  recentHydrationCache: {
    maxAreas: number;
  };
  visualPresentation: {
    maxCompositeChunks: number;
    rollingWindowEnabled: boolean;
    visualPageSize: { width: number; height: number };
    viewportMarginPages: number;
    maxCompositePages: number;
    criticalPageImmediateBudget: number;
    pageBuildFrameBudgetMs: number;
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
  toriiFetch: {
    superAreaStrides: number;
    explorerTroopsSuperAreaStrides: number;
    structuresSuperAreaStrides: number;
  };
  toriiSubscription: {
    superAreaStrides: number;
  };
  prefetch: {
    forwardDepthStrides: number;
    sideRadiusStrides: number;
    areaBoundaryLookaheadStrides: number;
    maxAhead: number;
    maxConcurrent: number;
  };
  recentHydrationCache: {
    maxAreas: number;
  };
  visualPresentation: {
    maxCompositeChunks: number;
    rollingWindowEnabled: boolean;
    visualPageSize: { width: number; height: number };
    viewportMarginPages: number;
    maxCompositePages: number;
    criticalPageImmediateBudget: number;
    pageBuildFrameBudgetMs: number;
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
    toriiFetch: {
      superAreaStrides: config.toriiFetch.superAreaStrides,
      explorerTroopsSuperAreaStrides: config.toriiFetch.explorerTroopsSuperAreaStrides,
      structuresSuperAreaStrides: config.toriiFetch.structuresSuperAreaStrides,
    },
    toriiSubscription: {
      superAreaStrides: config.toriiSubscription.superAreaStrides,
    },
    pin: {
      rowsAhead: config.pinRadius,
      rowsBehind: config.pinRadius,
      colsEachSide: config.pinRadius,
    },
    prefetch: {
      forwardDepthStrides: config.prefetch.forwardDepthStrides,
      sideRadiusStrides: config.prefetch.sideRadiusStrides,
      areaBoundaryLookaheadStrides: config.prefetch.areaBoundaryLookaheadStrides,
      maxAhead: config.prefetch.maxAhead,
      maxConcurrent: config.prefetch.maxConcurrent,
    },
    recentHydrationCache: {
      maxAreas: config.recentHydrationCache.maxAreas,
    },
    visualPresentation: {
      maxCompositeChunks: config.visualPresentation.maxCompositeChunks,
      rollingWindowEnabled: config.visualPresentation.rollingWindowEnabled,
      visualPageSize: config.visualPresentation.visualPageSize,
      viewportMarginPages: config.visualPresentation.viewportMarginPages,
      maxCompositePages: config.visualPresentation.maxCompositePages,
      criticalPageImmediateBudget: config.visualPresentation.criticalPageImmediateBudget,
      pageBuildFrameBudgetMs: config.visualPresentation.pageBuildFrameBudgetMs,
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
