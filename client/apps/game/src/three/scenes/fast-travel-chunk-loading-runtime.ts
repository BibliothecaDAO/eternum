import { getRenderBounds } from "../utils/chunk-geometry";
import {
  resolveWarpTravelVisibleChunkDecision,
  type WarpTravelVisibleChunkDecision,
} from "./warp-travel-chunk-runtime";

const FAST_TRAVEL_HEX_SIZE = 1;

export interface FastTravelChunkPolicy {
  chunkSize: number;
  renderSize: {
    width: number;
    height: number;
  };
  refreshDebounceMs: number;
}

export const FAST_TRAVEL_CHUNK_POLICY: FastTravelChunkPolicy = {
  chunkSize: 12,
  renderSize: {
    width: 18,
    height: 18,
  },
  refreshDebounceMs: 120,
};

export interface FastTravelChunkHydrationPlan {
  chunkKey: string;
  startCol: number;
  startRow: number;
  width: number;
  height: number;
}

export function resolveFastTravelChunkHydrationPlan(input: {
  startCol: number;
  startRow: number;
  chunkSize?: number;
  renderSize?: {
    width: number;
    height: number;
  };
}): FastTravelChunkHydrationPlan {
  const chunkSize = input.chunkSize ?? FAST_TRAVEL_CHUNK_POLICY.chunkSize;
  const renderSize = input.renderSize ?? FAST_TRAVEL_CHUNK_POLICY.renderSize;
  const renderBounds = getRenderBounds(input.startRow, input.startCol, renderSize, chunkSize);

  return {
    chunkKey: `${input.startRow},${input.startCol}`,
    startCol: renderBounds.minCol,
    startRow: renderBounds.minRow,
    width: renderSize.width,
    height: renderSize.height,
  };
}

export function resolveFastTravelVisibleChunkDecision(input: {
  isSwitchedOff: boolean;
  focusPoint: {
    x: number;
    z: number;
  };
  currentChunk: string;
  force?: boolean;
  reason?: "default" | "shortcut";
}): WarpTravelVisibleChunkDecision {
  return resolveWarpTravelVisibleChunkDecision({
    isSwitchedOff: input.isSwitchedOff,
    focusPoint: input.focusPoint,
    chunkSize: FAST_TRAVEL_CHUNK_POLICY.chunkSize,
    hexSize: FAST_TRAVEL_HEX_SIZE,
    currentChunk: input.currentChunk,
    force: input.force ?? false,
    reason: input.reason ?? "default",
    shouldDelayChunkSwitch: false,
  });
}
