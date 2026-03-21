import { shouldForceChunkRefreshForZoomDistanceChange } from "./worldmap-chunk-transition";

interface WorldmapZoomRefreshPlanInput {
  previousDistance: number | null;
  nextDistance: number;
  threshold: number;
  isScriptedTransitionActive: boolean;
  hasDeferredRefresh: boolean;
  deferredForceRefresh: boolean;
}

interface FlushDeferredWorldmapZoomRefreshInput {
  hasDeferredRefresh: boolean;
  deferredForceRefresh: boolean;
}

export interface WorldmapZoomRefreshPlan {
  shouldRequestRefreshNow: boolean;
  shouldForceRefreshNow: boolean;
  nextHasDeferredRefresh: boolean;
  nextDeferredForceRefresh: boolean;
}

export interface FlushDeferredWorldmapZoomRefreshResult {
  shouldRequestRefresh: boolean;
  shouldForceRefresh: boolean;
  nextHasDeferredRefresh: boolean;
  nextDeferredForceRefresh: boolean;
}

export function resolveWorldmapZoomRefreshPlan(input: WorldmapZoomRefreshPlanInput): WorldmapZoomRefreshPlan {
  if (!Number.isFinite(input.nextDistance)) {
    return {
      shouldRequestRefreshNow: false,
      shouldForceRefreshNow: false,
      nextHasDeferredRefresh: input.hasDeferredRefresh,
      nextDeferredForceRefresh: input.deferredForceRefresh,
    };
  }

  const shouldForceRefresh = shouldForceChunkRefreshForZoomDistanceChange({
    previousDistance: input.previousDistance,
    nextDistance: input.nextDistance,
    threshold: input.threshold,
  });

  if (input.isScriptedTransitionActive) {
    return {
      shouldRequestRefreshNow: false,
      shouldForceRefreshNow: false,
      nextHasDeferredRefresh: true,
      nextDeferredForceRefresh: input.deferredForceRefresh || shouldForceRefresh,
    };
  }

  return {
    shouldRequestRefreshNow: true,
    shouldForceRefreshNow: shouldForceRefresh,
    nextHasDeferredRefresh: input.hasDeferredRefresh,
    nextDeferredForceRefresh: input.deferredForceRefresh,
  };
}

export function flushDeferredWorldmapZoomRefresh(
  input: FlushDeferredWorldmapZoomRefreshInput,
): FlushDeferredWorldmapZoomRefreshResult {
  return {
    shouldRequestRefresh: input.hasDeferredRefresh,
    shouldForceRefresh: input.deferredForceRefresh,
    nextHasDeferredRefresh: false,
    nextDeferredForceRefresh: false,
  };
}
