import type { WorldmapChunkPresentationPhase } from "./worldmap-chunk-presentation";

interface RecoverWorldmapMapLoadingStateFromChunkTimeoutInput {
  phase: WorldmapChunkPresentationPhase;
  toriiLoadingCounter: number;
  clearMapLoading: () => void;
}

export const recoverWorldmapMapLoadingStateFromChunkTimeout = ({
  phase,
  toriiLoadingCounter,
  clearMapLoading,
}: RecoverWorldmapMapLoadingStateFromChunkTimeoutInput): number => {
  if (toriiLoadingCounter <= 0) {
    return toriiLoadingCounter;
  }

  if (phase !== "tile_fetch" && phase !== "bounds_ready") {
    return toriiLoadingCounter;
  }

  clearMapLoading();
  return 0;
};
