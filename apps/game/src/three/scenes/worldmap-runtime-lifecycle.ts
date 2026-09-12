interface WorldmapSwitchOffRuntimeStateInput {
  pinnedChunkKeys: Set<string>;
  pinnedRenderAreas: Set<string>;
  hydratedChunkRefreshes: Set<string>;
  hydratedRefreshSuppressionAreaKeys: Set<string>;
  clearStreamingWork: () => void;
  clearQueuedPrefetchState: () => void;
}

interface WorldmapSwitchOffRuntimeStateResult {
  isSwitchedOff: boolean;
  currentChunk: string;
  lastControlsCameraDistance: null;
}

interface WorldmapSwitchOffTransitionStateInput<TChunkSwitchPromise> {
  chunkTransitionToken: number;
  isChunkTransitioning: boolean;
  globalChunkSwitchPromise: TChunkSwitchPromise | null;
}

interface WorldmapSwitchOffTransitionStateResult {
  chunkTransitionToken: number;
  isChunkTransitioning: boolean;
  globalChunkSwitchPromise: null;
}

export const applyWorldmapSwitchOffRuntimeState = ({
  pinnedChunkKeys,
  pinnedRenderAreas,
  hydratedChunkRefreshes,
  hydratedRefreshSuppressionAreaKeys,
  clearStreamingWork,
  clearQueuedPrefetchState,
}: WorldmapSwitchOffRuntimeStateInput): WorldmapSwitchOffRuntimeStateResult => {
  clearStreamingWork();
  clearQueuedPrefetchState();
  pinnedChunkKeys.clear();
  pinnedRenderAreas.clear();
  hydratedChunkRefreshes.clear();
  hydratedRefreshSuppressionAreaKeys.clear();

  return {
    isSwitchedOff: true,
    currentChunk: "null",
    lastControlsCameraDistance: null,
  };
};

/**
 * Invalidate any in-flight chunk transition authority during switch-off.
 */
export const invalidateWorldmapSwitchOffTransitionState = <TChunkSwitchPromise>({
  chunkTransitionToken,
}: WorldmapSwitchOffTransitionStateInput<TChunkSwitchPromise>): WorldmapSwitchOffTransitionStateResult => {
  return {
    chunkTransitionToken: chunkTransitionToken + 1,
    isChunkTransitioning: false,
    globalChunkSwitchPromise: null,
  };
};
