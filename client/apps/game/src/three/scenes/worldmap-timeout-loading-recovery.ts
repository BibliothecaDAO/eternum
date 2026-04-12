import type { WorldmapChunkPresentationPhase } from "./worldmap-chunk-presentation";

interface RecoverWorldmapMapLoadingStateFromChunkTimeoutInput {
  phase: WorldmapChunkPresentationPhase;
  keepMapLoadingVisible: boolean;
  toriiLoadingCounter: number;
  clearMapLoading: () => void;
}

export const recoverWorldmapMapLoadingStateFromChunkTimeout = ({
  phase,
  keepMapLoadingVisible,
  toriiLoadingCounter,
  clearMapLoading,
}: RecoverWorldmapMapLoadingStateFromChunkTimeoutInput): number => {
  if (toriiLoadingCounter <= 0) {
    return toriiLoadingCounter;
  }

  if (phase !== "tile_fetch" && phase !== "bounds_ready") {
    return toriiLoadingCounter;
  }

  if (!keepMapLoadingVisible) {
    clearMapLoading();
  }
  return 0;
};
