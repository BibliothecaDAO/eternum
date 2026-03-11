import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";

interface WorldmapChunkPolicy {
  chunkSize: number;
  renderSize: { width: number; height: number };
  switchPadding: number;
  toriiFetch: {
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
    maxAhead: number;
    maxConcurrent: number;
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
  };
  prefetch: {
    forwardDepthStrides: number;
    sideRadiusStrides: number;
    maxAhead: number;
    maxConcurrent: number;
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
    },
    pin: {
      rowsAhead: config.pinRadius,
      rowsBehind: config.pinRadius,
      colsEachSide: config.pinRadius,
    },
    prefetch: {
      forwardDepthStrides: config.prefetch.forwardDepthStrides,
      sideRadiusStrides: config.prefetch.sideRadiusStrides,
      maxAhead: config.prefetch.maxAhead,
      maxConcurrent: config.prefetch.maxConcurrent,
    },
    cache: {
      pinnedChunkFloor,
      slack: matrixCacheSlack,
      recommendedMinSize: pinnedChunkFloor + matrixCacheSlack,
    },
  };
}
