import { resolveChunkSwitchActions } from "./worldmap-chunk-transition";

interface FinalizeWarpTravelChunkSwitchInput {
  projectionSyncSucceeded: boolean;
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
  preparedTerrain: unknown;
  commitPreparedTerrain: (preparedTerrain: unknown) => boolean | number | null | Promise<boolean | number | null>;
  /**
   * Phase 2.2: release the pooled attributes held by prepared terrain that is
   * dropped (rollback / stale) instead of applied. Without this the pooled
   * InstancedBufferAttributes leak for the lifetime of the renderer.
   */
  disposePreparedTerrain?: (preparedTerrain: unknown) => void;
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
  scheduleManagerCatchUp: (chunkKey: string, options: { force: boolean; transitionToken: number }) => void;
  unregisterPreviousChunkOnNextFrame: (chunkKey: string) => void;
}

export async function finalizeWarpTravelChunkSwitch(
  input: FinalizeWarpTravelChunkSwitchInput,
): Promise<{ status: "rolled_back" | "stale_dropped" | "committed" }> {
  const chunkSwitchActions = resolveChunkSwitchActions({
    projectionSyncSucceeded: input.projectionSyncSucceeded,
    isCurrentTransition: input.isCurrentTransition,
    targetChunk: input.targetChunk,
    previousChunk: input.previousChunk,
  });

  const disposeDroppedPreparedTerrain = () => {
    if (input.preparedTerrain !== null && input.preparedTerrain !== undefined) {
      input.disposePreparedTerrain?.(input.preparedTerrain);
    }
  };

  if (chunkSwitchActions.shouldRollback) {
    disposeDroppedPreparedTerrain();
    input.updatePinnedChunks(input.previousPinnedChunks);
    input.unregisterChunk(input.targetChunk);

    if (input.previousChunk && input.previousChunk !== "null") {
      if (
        chunkSwitchActions.shouldRestorePreviousState &&
        input.hasFiniteOldChunkCoordinates &&
        input.oldChunkCoordinates
      ) {
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
    };
  }

  if (!chunkSwitchActions.shouldCommitManagers) {
    disposeDroppedPreparedTerrain();
    if (input.currentChunk !== input.targetChunk) {
      input.unregisterChunk(input.targetChunk);
    }

    return {
      status: "stale_dropped",
    };
  }

  if (input.preparedTerrain === null || input.preparedTerrain === undefined) {
    throw new Error(`Chunk ${input.targetChunk} synchronized without prepared terrain`);
  }

  const terrainCommitResult = await input.commitPreparedTerrain(input.preparedTerrain);
  if (terrainCommitResult === false || terrainCommitResult === null) {
    return {
      status: "stale_dropped",
    };
  }
  input.updateCurrentChunkBounds(input.startRow, input.startCol);
  input.forceVisibilityUpdate();
  input.scheduleManagerCatchUp(input.targetChunk, {
    force: input.force,
    transitionToken: typeof terrainCommitResult === "number" ? terrainCommitResult : input.transitionToken,
  });

  if (chunkSwitchActions.shouldUnregisterPreviousChunk && input.previousChunk) {
    input.unregisterPreviousChunkOnNextFrame(input.previousChunk);
  }

  return {
    status: "committed",
  };
}
