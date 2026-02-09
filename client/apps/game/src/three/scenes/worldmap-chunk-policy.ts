import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";

export interface WorldmapChunkPolicy {
  chunkSize: number;
  renderSize: { width: number; height: number };
  switchPadding: number;
  pin: {
    rowsAhead: number;
    rowsBehind: number;
    colsEachSide: number;
  };
  prefetch: {
    maxAhead: number;
  };
}

interface WorldChunkPolicyInput {
  stride: number;
  renderSize: { width: number; height: number };
  pinRadius: number;
  switchPadding: number;
  prefetch: {
    maxAhead: number;
  };
}

export function createWorldmapChunkPolicy(config: WorldChunkPolicyInput = WORLD_CHUNK_CONFIG): WorldmapChunkPolicy {
  return {
    chunkSize: config.stride,
    renderSize: config.renderSize,
    switchPadding: config.switchPadding,
    pin: {
      rowsAhead: config.pinRadius,
      rowsBehind: config.pinRadius,
      colsEachSide: config.pinRadius,
    },
    prefetch: {
      maxAhead: config.prefetch.maxAhead,
    },
  };
}
