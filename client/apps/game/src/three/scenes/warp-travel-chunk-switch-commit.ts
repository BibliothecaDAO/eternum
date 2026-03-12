import { resolveChunkSwitchActions } from "./worldmap-chunk-transition";

interface FinalizeWarpTravelChunkSwitchInput {
  fetchSucceeded: boolean;
  isCurrentTransition: boolean;
  targetChunk: string;
  previousChunk: string;
  currentChunk: string;
  previousPinnedChunks: string[];
  hasFiniteOldChunkCoordinates: boolean;
  oldChunkCoordinates: [number, number] | null;
  startRow: number;
  startCol: number;
  force: boolean;
  transitionToken: number;
  setCurrentChunk: (chunkKey: string) => void;
  updatePinnedChunks: (chunkKeys: string[]) => void;
  unregisterChunk: (chunkKey: string) => void;
  restorePreviousChunkVisuals: (
    oldStartRow: number,
    oldStartCol: number,
    previousChunk: string,
    transitionToken: number,
  ) => Promise<void>;
  clearSceneChunkBounds: () => void;
  forceVisibilityUpdate: () => void;
  updateCurrentChunkBounds: (startRow: number, startCol: number) => void;
  updateManagersForChunk: (
    chunkKey: string,
    options: { force: boolean; transitionToken: number },
  ) => Promise<void>;
  unregisterPreviousChunkOnNextFrame: (chunkKey: string) => void;
}

export async function finalizeWarpTravelChunkSwitch(
  input: FinalizeWarpTravelChunkSwitchInput,
): Promise<{ status: "rolled_back" | "stale_dropped" | "committed"; nextCurrentChunk: string }> {
  const chunkSwitchActions = resolveChunkSwitchActions({
    fetchSucceeded: input.fetchSucceeded,
    isCurrentTransition: input.isCurrentTransition,
    targetChunk: input.targetChunk,
    previousChunk: input.previousChunk,
  });

  if (chunkSwitchActions.shouldRollback) {
    input.updatePinnedChunks(input.previousPinnedChunks);
    input.unregisterChunk(input.targetChunk);

    if (input.previousChunk && input.previousChunk !== "null") {
      if (chunkSwitchActions.shouldRestorePreviousState && input.hasFiniteOldChunkCoordinates && input.oldChunkCoordinates) {
        await input.restorePreviousChunkVisuals(
          input.oldChunkCoordinates[0],
          input.oldChunkCoordinates[1],
          input.previousChunk,
          input.transitionToken,
        );
      }
    } else {
      input.clearSceneChunkBounds();
    }

    input.forceVisibilityUpdate();
    return {
      status: "rolled_back",
      nextCurrentChunk: input.previousChunk ?? "null",
    };
  }

  if (!chunkSwitchActions.shouldCommitManagers) {
    if (input.currentChunk !== input.targetChunk) {
      input.unregisterChunk(input.targetChunk);
    }

    return {
      status: "stale_dropped",
      nextCurrentChunk: input.currentChunk,
    };
  }

  input.setCurrentChunk(input.targetChunk);
  input.updateCurrentChunkBounds(input.startRow, input.startCol);
  input.forceVisibilityUpdate();
  await input.updateManagersForChunk(input.targetChunk, {
    force: input.force,
    transitionToken: input.transitionToken,
  });

  if (chunkSwitchActions.shouldUnregisterPreviousChunk && input.previousChunk) {
    input.unregisterPreviousChunkOnNextFrame(input.previousChunk);
  }

  return {
    status: "committed",
    nextCurrentChunk: input.targetChunk,
  };
}
